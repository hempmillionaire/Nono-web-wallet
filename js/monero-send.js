// SPDX-License-Identifier: MIT
/**
 * monero-send.js — Send-transaction module for monero-web
 *
 * Uses MoneroCore (mymonero-loader.js) for address validation and tx signing.
 * Output selection and fee calculation are done in pure JS to avoid the
 * async callback issue with the WASM's send_funds() function.
 *
 * Public API:
 *   MoneroSend.validateAddress(addr)        → { valid, reason, subaddress, integrated }
 *   MoneroSend.estimateFee(keys, to, amt, prio)  → { fee_xmr, fee_atomic, per_byte }
 *   MoneroSend.send(keys, to, amt, prio, pid, preview) → Promise<{ tx_hash }>
 *
 * Depends on:
 *   js/mymonero-loader.js  (MoneroCore — WASM bridge for sendStep2)
 *   js/lws-client.js       (LwsClient for network I/O)
 */

const MoneroSend = (function () {
  'use strict';

  const DEFAULT_MIXIN = 15;

  var _sendTrace = { stage: 'init', events: [] };

  function traceSend (stage, data) {
    _sendTrace.stage = stage;
    _sendTrace.events.push({ t: new Date().toISOString(), stage: stage, data: data || null });
    if (_sendTrace.events.length > 30) _sendTrace.events.shift();
    console.log('[monero-send]', stage, data || '');
  }

  function signerStatus () {
    var loaded = typeof MoneroCore !== 'undefined' && MoneroCore.isLoaded && MoneroCore.isLoaded();
    var err = null;
    if (typeof MoneroCore !== 'undefined' && MoneroCore.loadError) {
      err = MoneroCore.loadError();
    }
    return { loaded: !!loaded, loadError: err };
  }

  function wasmExceptionMessage (e) {
    if (typeof e === 'number') {
      try {
        var mod = MoneroCore._getModule ? MoneroCore._getModule() : null;
        if (mod && mod.UTF8ToString) {
          var s = mod.UTF8ToString(e);
          if (s) return s;
        }
      } catch (x) {}
      return 'WASM native exception (code ' + e + ')';
    }
    if (e && e.message) return e.message;
    return String(e);
  }

  function failSend (stage, message, extra) {
    var dbg = {
      stage: stage,
      message: message,
      signer: signerStatus(),
      trace: _sendTrace.events.slice(),
      extra: extra || {},
    };
    var err = new Error(message);
    err.stage = stage;
    err.sendDebug = dbg;
    console.error('[monero-send] FAIL @' + stage, message, dbg);
    throw err;
  }

  function getLastSendTrace () {
    return _sendTrace;
  }

  function netParams (walletKeys) {
    var nid = networkIdFromKeys(walletKeys);
    var cfg = (typeof Networks !== 'undefined') ? Networks.get(nid) : {};
    return {
      netId: nid,
      nettype: 'MAINNET',
      forkVersion: String(cfg.hardForkVersion != null ? cfg.hardForkVersion : 16),
      mixin: (cfg.defaultMixin != null ? cfg.defaultMixin : DEFAULT_MIXIN),
    };
  }

  /** MyMonero WASM only accepts a strict subset of LWS output fields. */
  function sanitizeSpendableOut (raw) {
    var out = {
      amount: String(raw.amount),
      public_key: raw.public_key,
      global_index: String(raw.global_index),
      index: String(raw.index != null ? raw.index : 0),
      tx_pub_key: raw.tx_pub_key,
    };
    if (raw.rct && raw.rct !== '') out.rct = raw.rct;
    return out;
  }

  function normalizeMixOuts (amountOuts) {
    return (amountOuts || []).map(function (ao) {
      var ring = ao.outputs || ao.outs || [];
      return {
        amount: String(ao.amount != null ? ao.amount : '0'),
        outputs: ring.map(function (m) {
          var row = {
            global_index: String(m.global_index),
            public_key: m.public_key,
          };
          if (m.rct) row.rct = m.rct;
          return row;
        }),
      };
    });
  }

  function validateMixRings (mixOuts, ringSize) {
    for (var i = 0; i < mixOuts.length; i++) {
      var n = (mixOuts[i].outputs || []).length;
      if (n < ringSize) {
        return 'Ring ' + i + ' has only ' + n + ' decoys but needs at least ' + ringSize;
      }
    }
    return null;
  }

  function atomicMultiplierFor (networkId) {
    if (typeof Networks !== 'undefined') {
      return Networks.atomicMultiplier(networkId || 'nono-mainnet');
    }
    return 10000000000n; // NONO: 10 decimal places
  }

  // ── Address validation (no WASM needed) ───────────────────────────

  function validateAddress (addr) {
    if (!addr || typeof addr !== 'string') {
      return { valid: false, reason: 'empty' };
    }
    addr = addr.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{95,106}$/.test(addr)) {
      return { valid: false, reason: 'wrong length or character set' };
    }
    var subaddress = false, integrated = false;
    if (addr.length === 106) {
      integrated = true;
    } else if (addr[0] === '8') {
      subaddress = true;
    }
    return { valid: true, subaddress: subaddress, integrated: integrated, raw: addr };
  }

  // ── Amount helpers ────────────────────────────────────────────────

  function networkIdFromKeys (walletKeys) {
    if (typeof Networks !== 'undefined' && walletKeys && walletKeys.network) {
      return Networks.resolve(walletKeys.network);
    }
    return 'nono-mainnet';
  }

  function xmrToAtomic (xmrStr, networkId) {
    var id = networkId || 'nono-mainnet';
    if (typeof Networks !== 'undefined') {
      return Networks.parseAtomic(xmrStr, id).toString();
    }
    var s = String(xmrStr).trim().replace(',', '.');
    if (!s) return '0';
    if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) throw new Error('Invalid amount');
    var parts = s.split('.');
    var whole = parts[0] || '0';
    var dec = (typeof Networks !== 'undefined') ? Networks.getAtomicDecimals(networkId) : 10;
    var frac = (parts[1] || '').padEnd(dec, '0').substring(0, dec);
    var mul = atomicMultiplierFor(networkId);
    return (BigInt(whole) * mul + BigInt(frac)).toString();
  }

  function atomicToXmr (atomic, networkId) {
    var id = networkId || 'nono-mainnet';
    if (typeof Networks !== 'undefined') {
      return Networks.formatAtomic(atomic, id);
    }
    var n = BigInt(String(atomic || '0'));
    var mul = atomicMultiplierFor(id);
    var whole = n / mul;
    var frac = n % mul;
    if (frac === 0n) return whole.toString();
    var dec = (typeof Networks !== 'undefined') ? Networks.getAtomicDecimals(id) : 10;
    var fracStr = frac.toString().padStart(dec, '0').replace(/0+$/, '');
    return whole.toString() + '.' + fracStr;
  }

  // ── Fee estimation ────────────────────────────────────────────────

  var PRIO_MULT = { 1: 1, 2: 4, 3: 20, 4: 166 };
  var TYPICAL_TX_BYTES = 2000;

  async function estimateFee (walletKeys, toAddress, xmrAmount, priority) {
    // mixin=0: fetch ALL outputs regardless of their historical ring size.
    // Old RingCT outputs received in low-mixin txs (2019-2021 era) are perfectly
    // spendable in modern transactions — LWS's mixin filter incorrectly hides them.
    var outs = await LwsClient.getUnspentOuts(
      walletKeys.address,
      walletKeys.privateViewKeyHex,
      '0', 0, true
    );

    var perKbFee = BigInt(outs.per_kb_fee || outs.per_byte_fee * 1024 || '24658');
    var feeMask = BigInt(outs.fee_mask || '10000');
    var mult = BigInt(PRIO_MULT[priority] || 4);

    var feeAtomic = (perKbFee * BigInt(TYPICAL_TX_BYTES) * mult) / 1024n;
    if (feeMask > 0n) {
      feeAtomic = ((feeAtomic + feeMask - 1n) / feeMask) * feeMask;
    }

    var netId = networkIdFromKeys(walletKeys);
    return {
      fee_atomic: feeAtomic.toString(),
      fee_xmr: atomicToXmr(feeAtomic, netId),
      per_byte: (perKbFee / 1024n).toString(),
      _unspentResp: outs,
    };
  }

  // ── Send transaction ──────────────────────────────────────────────

  async function send (walletKeys, toAddress, xmrAmount, priority, paymentId, preview) {
    _sendTrace = { stage: 'init', events: [] };
    traceSend('start', { to: (toAddress || '').slice(0, 12) + '…', amount: xmrAmount, priority: priority });

    try {
      await MoneroCore.load();
      traceSend('signer_load', signerStatus());
    } catch (e) {
      failSend('signer_load', 'Transaction signing requires a component that could not load (' + wasmExceptionMessage(e) + ').', { loadException: wasmExceptionMessage(e) });
    }

    var amountAtomic = BigInt(xmrToAtomic(xmrAmount, networkIdFromKeys(walletKeys)));

    // 1. Always fetch fresh unspent outputs (never use cached preview —
    // the LWS state can change between Review and Confirm steps).
    //
    // mixin=0: fetch ALL outputs regardless of their historical ring size.
    // LWS filters outputs by the mixin count of the RECEIVING transaction, not
    // the spending transaction. Old RingCT outputs received in low-mixin txs
    // (typically 2–10 ring members, 2017–2021 era) are perfectly spendable in
    // modern transactions — they just look "underspendable" to LWS's filter.
    // Passing mixin=0 bypasses that filter so we see every output.
    var unspentResp;
    try {
      unspentResp = await LwsClient.getUnspentOuts(
        walletKeys.address, walletKeys.privateViewKeyHex,
        '0', 0, true
      );
      traceSend('unspent_fetch', {
        outputCount: unspentResp && unspentResp.outputs ? unspentResp.outputs.length : 0,
        per_kb_fee: unspentResp && unspentResp.per_kb_fee,
      });
    } catch (e) {
      failSend('unspent_fetch', 'Failed to fetch spendable outputs: ' + wasmExceptionMessage(e), {});
    }

    if (!unspentResp || !Array.isArray(unspentResp.outputs) || unspentResp.outputs.length === 0) {
      failSend('unspent_fetch', 'No spendable outputs found (LWS returned ' +
        (unspentResp ? (unspentResp.outputs ? unspentResp.outputs.length : 'no outputs field') : 'null') + ')', {
        unspentResp: unspentResp ? { keys: Object.keys(unspentResp) } : null,
      });
    }

    // Verify which outputs are actually spendable using key_image
    // verification. Outputs with spend_key_images may be falsely flagged
    // (ring decoy appearances from other wallets' transactions). Compute
    // the real key_image and check if it truly appears in the spend list.
    //
    // Also skip pre-RingCT outputs (empty rct field): those were created
    // before Monero's v9 hard fork (Oct 2018) and cannot be included in
    // modern RingCT transactions regardless of their unspent status.
    var spendableOuts = [];
    for (var oi = 0; oi < unspentResp.outputs.length; oi++) {
      var o = unspentResp.outputs[oi];

      // Skip pre-RingCT outputs — they can't be spent in modern transactions.
      // These have an empty or missing rct field and were received before v9.
      if (!o.rct || o.rct === '') continue;

      if (!o.spend_key_images || o.spend_key_images.length === 0) {
        // No spend reports — definitely unspent
        spendableOuts.push(o);
      } else {
        // Has spend reports — verify with key_image
        try {
          var realKI = MoneroCore.generateKeyImage(
            o.tx_pub_key,
            walletKeys.privateViewKeyHex,
            walletKeys.publicSpendKeyHex,
            walletKeys.privateSpendKeyHex,
            o.index
          );
          // If the real key_image is NOT in the spend list, the output
          // is unspent (the reports are false positives from ring decoys)
          var isSpent = o.spend_key_images.indexOf(realKI) >= 0;
          if (!isSpent) spendableOuts.push(o);
        } catch (e) {
          // Key_image computation failed — skip this output to be safe
        }
      }
    }

    if (spendableOuts.length === 0) {
      throw new Error('No spendable outputs available. Your funds may still be confirming — wait a few minutes and try again.');
    }

    var np = netParams(walletKeys);
    var perByteFee = Number(unspentResp.per_byte_fee || unspentResp.per_kb_fee / 1024 || 20);
    var feeMask = Number(unspentResp.fee_mask || 10000);
    var sanitizedUnspent = spendableOuts.map(sanitizeSpendableOut);

    // 2. WASM step1 — output selection, fee, mixin (MyMonero-native path)
    var step1;
    try {
      step1 = MoneroCore.sendStep1({
        is_sweeping: '0',
        payment_id_string: paymentId || '',
        sending_amount: amountAtomic.toString(),
        priority: String(priority || 2),
        fee_per_b: String(perByteFee),
        fee_mask: String(feeMask),
        fork_version: np.forkVersion,
        unspent_outs: sanitizedUnspent,
        nettype_string: np.nettype,
      });
      traceSend('tx_plan', {
        mixin: step1.mixin,
        fee_amount: step1.fee_amount,
        change_amount: step1.change_amount,
        using_outs: step1.using_outs ? step1.using_outs.length : 0,
      });
    } catch (e) {
      failSend('tx_plan', 'Transaction planning failed: ' + wasmExceptionMessage(e), {
        fork_version: np.forkVersion,
        spendable: sanitizedUnspent.length,
      });
    }

    var wasmOutputs = (step1.using_outs || []).map(sanitizeSpendableOut);
    if (!wasmOutputs.length) {
      failSend('tx_plan', 'Transaction planning returned no spendable outputs', { step1: step1 });
    }

    var feeAmount = BigInt(step1.fee_amount || step1.required_fee || '0');
    var changeAmount = BigInt(step1.change_amount || '0');
    var finalTotal = BigInt(step1.final_total_wo_fee || amountAtomic.toString());
    var mixin = parseInt(step1.mixin, 10);
    if (!mixin || mixin < 1) mixin = np.mixin;
    var ringSize = mixin + 1;

    traceSend('output_selection', {
      selectedOutputs: wasmOutputs.length,
      feeAtomic: String(feeAmount),
      changeAtomic: String(changeAmount),
      mixin: mixin,
      ringSize: ringSize,
    });

    // 3. Fetch ring decoys
    var decoyAmounts = wasmOutputs.map(function () { return '0'; });
    var mixResp;
    try {
      mixResp = await LwsClient.getRandomOuts(decoyAmounts, ringSize);
    } catch (e) {
      failSend('decoys_fetch', 'Failed to fetch ring decoys: ' + wasmExceptionMessage(e), {});
    }
    if (!mixResp || !Array.isArray(mixResp.amount_outs)) {
      failSend('decoys_fetch', 'Failed to fetch ring decoys from server (empty response)', { mixResp: mixResp });
    }
    var mixOuts = normalizeMixOuts(mixResp.amount_outs);
    var ringErr = validateMixRings(mixOuts, ringSize);
    if (ringErr) {
      failSend('decoys_fetch', ringErr + ' — chain may be too young for mixin ' + mixin + '; try again later or lower mixin in network config.', {
        ringSize: ringSize,
        rings: mixOuts.map(function (r) { return (r.outputs || []).length; }),
      });
    }
    traceSend('decoys_fetch', {
      rings: mixOuts.length,
      membersPerRing: mixOuts.map(function (r) { return (r.outputs || []).length; }),
    });

    // 4. Build and sign via WASM
    var step2Params = {
      from_address_string: walletKeys.address,
      sec_viewKey_string: walletKeys.privateViewKeyHex,
      sec_spendKey_string: walletKeys.privateSpendKeyHex,
      to_address_string: toAddress,
      final_total_wo_fee: finalTotal.toString(),
      change_amount: changeAmount.toString(),
      fee_amount: feeAmount.toString(),
      priority: String(priority || 2),
      fee_per_b: String(perByteFee),
      fee_mask: String(feeMask),
      using_outs: wasmOutputs,
      mix_outs: mixOuts,
      unlock_time: '0',
      nettype_string: np.nettype,
      fork_version: np.forkVersion,
    };
    if (paymentId) step2Params.payment_id_string = paymentId;

    var step2Result;
    try {
      traceSend('tx_sign', { inputs: wasmOutputs.length, mixin: mixin, fork: np.forkVersion });
      step2Result = MoneroCore.sendStep2(step2Params);
      traceSend('tx_sign', {
        ok: !!(step2Result && step2Result.serialized_signed_tx),
        tx_hash: step2Result && step2Result.tx_hash,
        signed_len: step2Result && step2Result.serialized_signed_tx ? step2Result.serialized_signed_tx.length : 0,
      });
    } catch (e) {
      failSend('tx_sign', 'Transaction signing failed: ' + wasmExceptionMessage(e), {
        step2ParamsSummary: {
          outs: wasmOutputs.length,
          mix: mixResp.amount_outs.length,
          fee: String(feeAmount),
          change: String(changeAmount),
        },
      });
    }

    if (!step2Result || !step2Result.serialized_signed_tx) {
      failSend('tx_sign', 'Transaction signing failed — no signed output', { step2Result: step2Result });
    }

    // 6. Broadcast
    var broadcastResp;
    try {
      broadcastResp = await LwsClient.submitRawTx(step2Result.serialized_signed_tx);
      traceSend('broadcast', { status: broadcastResp && broadcastResp.status, error: broadcastResp && broadcastResp.error });
      if (!broadcastResp || broadcastResp.status !== 'OK') {
        var reason = (broadcastResp && broadcastResp.reason) || (broadcastResp && broadcastResp.error) || JSON.stringify(broadcastResp) || 'unknown';
        failSend('broadcast', 'Broadcast rejected: ' + reason, { broadcastResp: broadcastResp });
      }
    } catch (bcErr) {
      if (bcErr && bcErr.stage) throw bcErr;
      var errMsg = wasmExceptionMessage(bcErr);
      traceSend('broadcast', { exception: errMsg });
      if (/double.spend|already.spent/i.test(errMsg)) {
        failSend('broadcast', 'Transaction rejected — an output was already spent. Wait a few minutes for confirmations and try again.', { errMsg: errMsg });
      } else if (/invalid.input/i.test(errMsg)) {
        failSend('broadcast', 'Transaction rejected by the network (invalid input).', { errMsg: errMsg });
      } else if (/fee.too.low/i.test(errMsg)) {
        failSend('broadcast', 'Transaction fee is too low. Try a higher priority.', { errMsg: errMsg });
      } else if (/network|reach|timeout/i.test(errMsg)) {
        failSend('broadcast', 'Could not reach the wallet server. Check your connection and try again.', { errMsg: errMsg });
      } else if (/HTTP\s*500|server.error/i.test(errMsg)) {
        failSend('broadcast', 'The wallet server rejected this transaction. Wait a few minutes and try again.', { errMsg: errMsg });
      } else {
        failSend('broadcast', 'Broadcast failed: ' + errMsg + '. Your funds have not been sent.', { errMsg: errMsg });
      }
    }

    traceSend('complete', { tx_hash: step2Result.tx_hash });

    return {
      tx_hash: step2Result.tx_hash,
      tx_key: step2Result.tx_key || '',
      mixin: mixin,
    };
  }

  return {
    validateAddress: validateAddress,
    estimateFee: estimateFee,
    send: send,
    getLastSendTrace: getLastSendTrace,
    signerStatus: signerStatus,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MoneroSend;
