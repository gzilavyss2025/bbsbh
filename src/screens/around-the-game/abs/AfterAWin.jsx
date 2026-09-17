import { useMemo } from 'react'
import { momentum, momentumLevels } from '../../../api/around-the-game/absChallenges.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { ColumnChart, roundTicks } from '../../../components/around-the-game/BroadcastBar.jsx'
import { commas, num1, num2 } from './format.js'

// AFTER A WIN, AFTER A LOSS — the question this page is most likely to answer
// wrongly, and the one section whose whole job is to stop it.
//
// COUNTED STRAIGHT IT LOOKS LIKE NERVE. A club asks about 15 times per 100
// armed half-innings after winning a review and about 11 after losing one, and
// a 26% drop invites exactly one reading. IT IS THE RULEBOOK. A club that has
// just lost one holds one fewer, so it is ALLOWED to ask less; nothing about
// its nerve has been measured at all.
//
// HELD EQUAL THE GAP ALL BUT VANISHES. Take only the club's second call of the
// night, with exactly one still in hand, so the single difference between two
// clubs is how the last call went — and MLB comes back at 12.72 against 12.77,
// tipped the other way, while Triple-A tips back at 14.64 against 14.04. TWO
// INDEPENDENT LEAGUES THAT DISAGREE ON THE SIGN HAVE NOT FOUND AN EFFECT, which
// is why the other league is a PANEL here and not a sentence: on a surface
// whose whole method is a pair of bars, the third pair is what makes the
// conclusion land.
//
// SO THE THREE PANELS SHARE ONE SCALE and the control ships with the naive cut,
// always. A page that printed the first panel alone would have published the
// opposite of what the data says, and would have looked more interesting doing
// it.
//
// AND THE ERROR SHIPS WITH THE GAP. `errors` is how many standard errors the
// gap is worth — under one on both club cuts — and it is a FLOOR, because it
// counts every armed half-inning as an independent trial when the halves of one
// game share a club, an umpire and a night.
//
// NO PER-CLUB SPLIT AND NO "INNINGS UNTIL THE NEXT ONE". MLB's second calls
// over thirty clubs is about fifty each against an effect of a tenth of a
// challenge per 100 half-innings: a board drawn that way manufactures noise and
// then ranks it. A wait-until-next-call would drop every club that never asked
// again, which is the answer written into the question.

// Rates ship as shares and print per hundred, the same scale the club, umpire
// and inning boards already use.
const per100 = (x) => (x == null ? null : x * 100)

function Pair({ title, sub, cut, max, ticks }) {
  if (cut?.win?.rate == null || cut?.loss?.rate == null) return null
  const columns = [
    { key: 'win', label: 'After a win', value: per100(cut.win.rate) },
    { key: 'loss', label: 'After a loss', value: per100(cut.loss.rate), tone: 'soft' },
  ].map((c) => ({ ...c, note: num2(c.value) }))
  return (
    <div className="colchart__panel">
      <span className="colchart__paneltitle">{title}</span>
      <span className="colchart__panelsub">{sub}</span>
      <ColumnChart
        columns={columns}
        max={max}
        ticks={ticks}
        label={`${title}: challenges per 100 armed half-innings after a win and after a loss`}
      />
    </div>
  )
}

export function AfterAWin({ summary, data, level }) {
  const club = useMemo(() => momentum(summary, 'club'), [summary])
  const player = useMemo(() => momentum(summary, 'player'), [summary])
  // The cross-level cut takes the WHOLE file, not one level's summary: two
  // leagues that disagree on the sign is the answer to the question, and it
  // cannot be read off either league alone.
  const levels = useMemo(() => momentumLevels(data, 'club'), [data])
  const playerLevels = useMemo(() => momentumLevels(data, 'player'), [data])

  if (!club) return null

  const other = levels.rows.find((r) => r.level !== level) ?? null
  const otherPlayer = playerLevels.rows.find((r) => r.level !== level) ?? null

  // ONE SCALE ACROSS ALL THREE PANELS. The second panel is only an answer to
  // the first if a reader can lay them against each other, and a panel drawn on
  // its own maximum makes every pair look the same size.
  const rates = [club.naive, club.strict, other]
    .filter(Boolean)
    .flatMap((c) => [per100(c.win?.rate), per100(c.loss?.rate)])
    .filter((x) => x != null)
  const max = Math.max(5, Math.ceil(Math.max(...rates) / 5) * 5)
  const ticks = roundTicks(max, 5)

  const strict = club.strict
  const gap = per100(strict.gap)

  return (
    <BroadcastSection title="After a win, after a loss">
      <div className="colchart__trio">
        <Pair
          title="Counted straight"
          sub="Every call, whatever the club was holding"
          cut={club.naive}
          max={max}
          ticks={ticks}
        />
        <Pair
          title="Held equal"
          sub="The club's second call, with one still in hand"
          cut={strict}
          max={max}
          ticks={ticks}
        />
        {other ? (
          <Pair
            title={`${other.label}, held equal`}
            sub="The same control, the other league"
            cut={other}
            max={max}
            ticks={ticks}
          />
        ) : null}
      </div>

      {/* THE ONE SENTENCE NO BAR CAN CARRY, under the panel that needs it: the
          first pair states a real difference and invites a causal reading of
          it, and only prose can say that the cause is the rulebook. */}
      <p className="hint rptprose">
        Counted straight a club asks {num2(per100(club.naive.win.rate))} times per 100
        armed half-innings after winning a review and{' '}
        {num2(per100(club.naive.loss.rate))} after losing one, and the drop reads as
        nerve. It is the rulebook. A club that has just lost one holds one fewer, so
        it is allowed to ask less — nothing about its nerve has been measured.
      </p>

      <p className="hint rptprose">
        Held equal — the club’s second call of the night, with exactly one still in
        hand, so the only difference between two clubs is how the last call went — the
        gap is {num2(Math.abs(gap))} per 100, {num1(strict.errors)} standard errors.
        That error is a floor rather than a measurement: it counts every armed
        half-inning as an independent trial when the halves of one game share a club,
        an umpire and a night, so the true error is wider and the gap is even less
        than it looks.{' '}
        {/* The asymmetry in the two counts IS the confound, stated where a
            reader can check it against the bars above. */}
        {commas(strict.win.events)} calls followed a win under that control and{' '}
        {commas(strict.loss.events)} followed a loss, because fewer clubs reach a
        second call after losing the first.
      </p>

      {other ? (
        <p className="hint rptprose">
          {levels.agree ? (
            <>
              {other.label} moves the same way and is worth{' '}
              {num1(other.errors)} standard errors, which is a gap of the same size as
              its own uncertainty. Neither league has found an effect.
            </>
          ) : (
            <>
              And {other.label} tips the other way, by{' '}
              {num2(Math.abs(per100(other.gap)))} per 100 at {num1(other.errors)}{' '}
              standard errors. Two independent leagues that disagree on the sign have
              not found an effect — which is the answer to the question, and the
              reason the third pair is drawn rather than described.
            </>
          )}
        </p>
      ) : null}

      {player?.strict?.win?.rate != null ? (
        <p className="hint rptprose">
          Asked of the MAN rather than the club — does he call for another after being
          right — the same control gives {num2(per100(player.strict.win.rate))} against{' '}
          {num2(per100(player.strict.loss.rate))} here
          {otherPlayer
            ? `, and ${num2(per100(otherPlayer.win.rate))} against ${num2(
                per100(otherPlayer.loss.rate),
              )} in ${otherPlayer.label}`
            : ''}
          . Those point the same way at both levels and are worth{' '}
          {num1(player.strict.errors)} standard errors here. Suggestive, and not a
          result.
        </p>
      ) : null}
    </BroadcastSection>
  )
}
