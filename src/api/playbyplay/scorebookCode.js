// The batter's own Numbers-Game-#22-style scorebook denotation — how he
// reached (1B, 2B, HR, BB, E6, FC…) or how he was retired (K, F8, L7, 6-3…).
// See ../playbyplay.js's header for the module's overall spoiler footing.
// Split (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js.

// How-reached codes keyed on the play's eventType, for a batter who was NOT
// retired on his own plate appearance.
const REACH_CODES = {
  single: '1B',
  double: '2B',
  triple: '3B',
  home_run: 'HR',
  walk: 'BB',
  intent_walk: 'IBB',
  hit_by_pitch: 'HBP',
  fielders_choice: 'FC',
  fielders_choice_out: 'FC',
  // A force out retires a PRECEDING runner while the batter reaches 1st
  // safely by rule (a batter also put out on the play is a double play, its
  // own eventType — see DOUBLE_PLAY_EVENTS below) — the batter's own
  // scorebook mark is "FC", same as a true fielder's choice. Verified
  // against gamePk 823035 ("Grounds into a force out… to 1st"): eventType
  // `force_out`, batter's own runner entry `end: '1B'`, no `isOut`. Without
  // this entry scorebookCode fell to the generic out-fallback, and since the
  // batter himself carries no putout/assist credits there, it silently
  // returned an empty code — a blank diamond with no label at all.
  force_out: 'FC',
  catcher_interf: 'CI',
}

const HIT_EVENTS = new Set(['single', 'double', 'triple', 'home_run'])

// Sacrifices — a plate appearance that is not an at-bat, each with its own
// scorebook mark. The `_double_play` variants are a sacrifice on which a second
// runner was also retired; the batter's own mark is still the sacrifice.
const SAC_FLY_EVENTS = new Set(['sac_fly', 'sac_fly_double_play'])
const SAC_BUNT_EVENTS = new Set(['sac_bunt', 'sac_bunt_double_play'])

// The FULL fielding chain for a ground-ball double/triple play, walked across
// EVERY runner retired on the play (in the order they were put out) rather
// than just the batter's own assist+putout pair — his own credits alone read
// "6-3" for a 4-6-3 double play, silently dropping the second baseman who
// started it (verified against a live 4-6-3: the front runner's own entry
// carries assist-6/putout-4, the batter's carries assist-4/putout-3 — the
// relay fielder shows up as BOTH the front runner's putout and the batter's
// assist, so consecutive duplicates collapse to one mention: 6, 4, 4, 3 →
// "6-4-3"). Runners are ordered by their own `movement.outNumber`, the same
// half-inning out sequence number runnerOutCode reads.
function fullChain(play) {
  const outRunners = (play.runners ?? [])
    .filter((r) => r.movement?.isOut && (r.credits ?? []).some((c) => /putout|assist/.test(c.credit ?? '')))
    .sort((a, b) => (a.movement?.outNumber ?? 0) - (b.movement?.outNumber ?? 0))
  const codes = []
  for (const r of outRunners) {
    for (const c of r.credits ?? []) {
      if (!/putout|assist/.test(c.credit ?? '')) continue
      const code = c.position?.code ?? ''
      if (code && codes[codes.length - 1] !== code) codes.push(code)
    }
  }
  return codes.join('-')
}

// The fielders who actually RETIRED somebody on this runner's leg, in feed
// order — his putout and assist credits, and nothing else. Everything else the
// feed hangs on `credits` records no out at all: `f_fielding_error` when the
// fielder booted it, `f_fielded_ball` when he picked the ball up and made no
// play. Letting those into the fielding chain invents a putout nobody made —
// a sacrifice bunt the third baseman threw away came out "SAC 5U", which reads
// as an unassisted putout BY that third baseman on a play where every runner
// was safe (verified against gamePk 818035's bottom 8th; the no-error twin is
// gamePk 824087's bottom 9th, an f_fielded_ball-only bunt that read "SAC 2U").
// Exact-matched rather than a substring test on "assist" for the same reason
// runnerOutCode is: an outfielder's throw carries `f_assist_of` alongside his
// `f_assist` and would double him up in the chain.
function outChain(runner) {
  return (runner?.credits ?? [])
    .filter((c) => c.credit === 'f_putout' || c.credit === 'f_assist')
    .map((c) => c.position?.code ?? '')
}

// "E5" for whichever fielder was charged with an error on this runner's own
// leg; '' when none was.
function errorCodeFor(runner) {
  const errCred = (runner?.credits ?? []).find((c) => /error/.test(c.credit ?? ''))
  return errCred ? `E${errCred.position?.code ?? ''}` : ''
}

// The mark for a SACRIFICE the batter was not retired on. He still gets the
// sacrifice — the rule credits one when a runner advances on a bunt or fly the
// batter would have been put out on but for the misplay — but there is no
// putout to pencil, so the tag carries how he REACHED instead: the charged
// error ("SAC E5"), or "FC" when the defense simply never played him (no out,
// no error). Same shape as the reached-on-a-strikeout mark ("K E2", "K WP")
// and, like it, a REACH kind: an out code is centered inside the diamond, and
// centering one here contradicted a diamond already showing the batter safe at
// first.
function sacReachCode(tag, batterRunner) {
  const err = errorCodeFor(batterRunner)
  return { code: `${tag} ${err || 'FC'}`, codeKind: err ? 'error' : 'reach' }
}

// The Numbers Game #22-style scorebook denotation for a batter's own plate
// appearance — shown above the per-play diamond. Either how he reached (1B,
// 2B, HR, BB, E6, FC…) or how he was retired (K, F8, L7, 6-3…). Returns a
// `kind` ('hit' | 'error' | 'reach' | 'out') so the card can ink hits green
// and errors red. A called third strike returns { calledLooking: true } so the
// card can draw the customary backwards K instead of a code string.
export function scorebookCode(play, batterRunner) {
  const et = play.result?.eventType
  if (REACH_CODES[et]) return { code: REACH_CODES[et], codeKind: HIT_EVENTS.has(et) ? 'hit' : 'reach' }

  const desc = play.result?.description ?? ''
  const chain = outChain(batterRunner)

  if (et === 'field_error') {
    return { code: errorCodeFor(batterRunner) || 'E', codeKind: 'error' }
  }
  // Every strikeout is a K — swinging, on a foul tip, on a foul bunt, a checked
  // swing — keyed off the eventType, not one description phrasing (a foul-tip K
  // reads "strikes out on a foul tip", not "…swinging", and used to fall through
  // to the catcher's putout "2"). The customary backwards "looking" K is drawn
  // only for a called third strike.
  if (et === 'strikeout' || et === 'strikeout_double_play') {
    // An uncaught/dropped third strike (or a strike three that got away on a
    // wild pitch / passed ball) still counts as a strikeout and an at-bat, but
    // the batter is NOT out — he reached first. Render it as a REACH (a top
    // code over a diamond that shows him aboard), annotated with how he got on,
    // rather than an out code penciled in the diamond center. Without this the
    // card showed a lone "K" over a diamond that already had him safe at first.
    const reachedSafe = batterRunner && !batterRunner.movement?.isOut && !!batterRunner.movement?.end
    if (reachedSafe) {
      // How he got on: a wild pitch or passed ball when the description names
      // one, else the charged error (E{pos}) when the feed carries an error
      // credit. When none is present, don't fabricate a catcher error — leave
      // it a bare "K" reach (the diamond still shows him aboard), since an
      // uncaught third strike can be scored with no error charged at all.
      let how
      if (/wild pitch/i.test(desc)) how = 'WP'
      else if (/passed ball/i.test(desc)) how = 'PB'
      else how = errorCodeFor(batterRunner)
      return { code: how ? `K ${how}` : 'K', codeKind: 'reach' }
    }
    if (/called out on strikes/i.test(desc)) return { calledLooking: true, codeKind: 'out' }
    return { code: 'K', codeKind: 'out' }
  }
  // A sacrifice fly reads "SF" with the fielder who made the catch (SF8); a sac
  // bunt "SAC" with its fielding chain (SAC 1-3). Keyed off the eventType (with
  // a description fallback) BEFORE the generic fly/ground branches below —
  // without it a sac fly's "hits a sacrifice fly to center fielder…" missed the
  // /flies (out|into)/ test and fell through to the unassisted-putout branch,
  // coming out as a bogus infield "8U".
  // Either can also come back with the batter SAFE — a sacrifice is credited
  // on a misplay that would otherwise have retired him — so both check that
  // before writing an out (see sacReachCode). Same test the strikeout branch
  // above uses.
  const reachedOnSac = batterRunner && !batterRunner.movement?.isOut && !!batterRunner.movement?.end
  if (SAC_FLY_EVENTS.has(et) || /sacrifice fly/i.test(desc)) {
    if (reachedOnSac) return sacReachCode('SF', batterRunner)
    return { code: `SF${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  }
  if (SAC_BUNT_EVENTS.has(et) || /sacrifice (bunt|hit)/i.test(desc)) {
    if (reachedOnSac) return sacReachCode('SAC', batterRunner)
    const c = chain.length === 1 ? `${chain[0]}U` : chain.join('-')
    return { code: c ? `SAC ${c}` : 'SAC', codeKind: 'out' }
  }
  // A double/triple play the batter hit into gets the play tag on his OWN card
  // too (the erased runner's card already gets one via runnerOutCode) — a bare
  // "6-4-3" doesn't say it turned two.
  const dpTag =
    et === 'grounded_into_double_play' || /into a double play/i.test(desc)
      ? 'DP '
      : et === 'triple_play' || et === 'grounded_into_triple_play' || /into a triple play/i.test(desc)
        ? 'TP '
        : ''
  // A ball caught for the out in FOUL territory gets an "F" penciled in front
  // of its normal code (a foul pop out to 1st is FP3, a foul fly to left is
  // FF7) — MLB's description names it explicitly ("… in foul territory").
  const foul = /in foul territory/i.test(desc) ? 'F' : ''
  if (/lines? (out|into)/i.test(desc)) return { code: `${dpTag}${foul}L${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  // A pop out (P) is its own scorebook code, distinct from a fly out (F) —
  // both come back from MLB as "pops out"/"flies out" in the description.
  if (/pops? (out|into)/i.test(desc)) return { code: `${dpTag}${foul}P${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  if (/flies? (out|into)/i.test(desc)) return { code: `${dpTag}${foul}F${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  // A single-fielder chain (no throw — he fielded it and recorded the putout
  // himself) is the scorebook's "unassisted" play: 3U, 6U, etc, not a bare
  // position number.
  const code = chain.length === 1 ? `${chain[0]}U` : chain.join('-')
  // A batter grounding into a double/triple play gets the FULL relay chain
  // (fullChain, above) rather than just his own assist+putout pair — and the
  // double-play case reads "GIDP" over the chain, on its own line, the way a
  // scorer pencils "GIDP" above the fielding numbers rather than running them
  // together as one cramped "DP 6-3".
  if (dpTag === 'DP ') return { code: `GIDP\n${fullChain(play) || code}`, codeKind: 'out' }
  if (dpTag === 'TP ') return { code: `${dpTag}${fullChain(play) || code}`, codeKind: 'out' }
  return { code: `${dpTag}${code}`, codeKind: 'out' }
}
