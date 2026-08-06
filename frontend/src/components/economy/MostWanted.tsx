// ============================================================
// MostWanted — the bounty board
// Sprint 15-B
//
// Players post contracts on specific members, or on a member's
// special people. Anyone else can take the work, upload proof, and
// cash out. Three things make this interesting:
//
//   1. The payout is public record. Cashing a contract tells the
//      target's gang exactly who to come see.
//   2. Fulfilling a contract makes you the poster's ally, which is
//      how alliances form without a friend system.
//   3. Contracts on special people are cheaper to survive but uglier
//      — they crater the target member's loyalty instead of killing
//      them, which is how you make somebody flip.
//
// Verification is trust-first: proof is a screenshot and the payout
// is automatic. A real referee would need a server, so instead the
// receipt is public and reputation does the policing.
// ============================================================

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  usePlayerStore,
  useGangStore,
  useEconomyStore,
  useNotificationStore,
} from '../../stores/gameStore';
import {
  useMostWantedStore,
  BOUNTY_CONFIG,
  listingFee,
  totalPostingCost,
  minimumReward,
  formatRemaining,
  remainingMs,
  canFulfil,
} from '../../stores/mostWantedStore';
import { useGetBackStore } from '../../stores/getBackStore';
import { RELATION_LABELS } from '../../utils/marketMembersCatalog';
import type { MostWantedPoster, SpecialPerson } from '../../types/game.types';
import { soundManager } from '../../utils/SoundManager';
import './MostWanted.css';

const formatMoney = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
};

type Tab = 'board' | 'mine' | 'post' | 'allies';

const TAB_LABELS: Record<Tab, string> = {
  board: 'THE BOARD',
  mine: 'MY CONTRACTS',
  post: 'POST ONE',
  allies: 'ALLIES',
};

/** Read an uploaded file as a data URL so proof survives a reload. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

const MostWanted: React.FC = () => {
  const { player, updateMoney, updateHeat } = usePlayerStore();
  const { members, contacts, addContact } = useGangStore();
  const { addTransaction } = useEconomyStore();
  const { addNotification } = useNotificationStore();

  const posters = useMostWantedStore((s) => s.posters);
  const allies = useMostWantedStore((s) => s.allies);
  const postBounty = useMostWantedStore((s) => s.postBounty);
  const cancelBounty = useMostWantedStore((s) => s.cancelBounty);
  const fulfilBounty = useMostWantedStore((s) => s.fulfilBounty);

  const openWindow = useGetBackStore((s) => s.openWindow);

  const [tab, setTab] = useState<Tab>('board');
  const [selected, setSelected] = useState<MostWantedPoster | null>(null);
  const [toast, setToast] = useState<string>('');
  const proofInputRef = useRef<HTMLInputElement>(null);
  const posterImageRef = useRef<HTMLInputElement>(null);

  // ── Post form state ──
  const [formTargetKind, setFormTargetKind] = useState<'member' | 'special_person'>('member');
  const [formTargetId, setFormTargetId] = useState<string>('');
  const [formReward, setFormReward] = useState<number>(BOUNTY_CONFIG.MIN_REWARD);
  const [formNote, setFormNote] = useState<string>('');
  const [formImage, setFormImage] = useState<string>('');

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }, []);

  const openBoard = useMemo(
    () => posters.filter((p) => p.status === 'open' && remainingMs(p) > 0),
    [posters],
  );

  const myPosters = useMemo(
    () => posters.filter((p) => p.postedBy === player.id),
    [posters, player.id],
  );

  // Opps in the contact book are the valid targets. You cannot post on
  // somebody you have never crossed paths with.
  const oppContacts = useMemo(
    () => contacts.filter((c) => c.status === 'opp'),
    [contacts],
  );

  /**
   * Special people you know about, flattened across every opp you know.
   * Own members are excluded — posting on your own crew's family is not a
   * mechanic, it is just self harm.
   */
  const knownSpecialPeople = useMemo(() => {
    const out: Array<{ person: SpecialPerson; ownerName: string; ownerId: string; gangName: string }> = [];
    for (const c of oppContacts) {
      const people = (c as unknown as { specialPeople?: SpecialPerson[] }).specialPeople ?? [];
      for (const person of people) {
        out.push({
          person,
          ownerName: c.name,
          ownerId: c.memberId ?? c.id,
          gangName: (c as unknown as { gangName?: string }).gangName ?? 'Unknown',
        });
      }
    }
    return out;
  }, [oppContacts]);

  const selectedTargetLevel = useMemo(() => {
    if (formTargetKind === 'member') {
      const c = oppContacts.find((x) => (x.memberId ?? x.id) === formTargetId);
      return c?.level ?? 1;
    }
    const entry = knownSpecialPeople.find((x) => x.person.id === formTargetId);
    if (!entry) return 1;
    const owner = oppContacts.find((x) => (x.memberId ?? x.id) === entry.ownerId);
    return owner?.level ?? 1;
  }, [formTargetKind, formTargetId, oppContacts, knownSpecialPeople]);

  const minReward = useMemo(
    () => minimumReward(selectedTargetLevel, formTargetKind),
    [selectedTargetLevel, formTargetKind],
  );

  // ── Post a contract ──
  const handlePost = useCallback(() => {
    if (!formTargetId) {
      flash('PICK A TARGET FIRST');
      return;
    }
    if (formReward < minReward) {
      flash(`MINIMUM FOR THIS TARGET IS ${formatMoney(minReward)}`);
      return;
    }

    const cost = totalPostingCost(formReward);
    if (player.money < cost) {
      flash(`NEED ${formatMoney(cost)} INCLUDING THE FEE`);
      return;
    }

    let targetName = '';
    let targetGangName = 'Unknown';
    let targetOwnerMemberId: string | undefined;
    let targetOwnerName: string | undefined;

    if (formTargetKind === 'member') {
      const c = oppContacts.find((x) => (x.memberId ?? x.id) === formTargetId);
      if (!c) { flash('TARGET NOT FOUND'); return; }
      targetName = c.nickname ? `${c.name} "${c.nickname}"` : c.name;
      targetGangName = (c as unknown as { gangName?: string }).gangName ?? 'Unknown';
    } else {
      const entry = knownSpecialPeople.find((x) => x.person.id === formTargetId);
      if (!entry) { flash('TARGET NOT FOUND'); return; }
      targetName = entry.person.name;
      targetGangName = entry.gangName;
      targetOwnerMemberId = entry.ownerId;
      targetOwnerName = entry.ownerName;
    }

    updateMoney(-cost);
    updateHeat(BOUNTY_CONFIG.POSTER_HEAT);

    const poster = postBounty({
      postedBy: player.id,
      postedByGangName: player.gangName ?? 'Your Gang',
      targetKind: formTargetKind,
      targetId: formTargetId,
      targetName,
      targetGangName,
      targetOwnerMemberId,
      targetOwnerName,
      posterImageUrl: formImage || undefined,
      note: formNote.trim() || undefined,
      reward: formReward,
    });

    addTransaction({
      id: `tx_bounty_${Date.now()}`,
      type: 'purchase',
      userId: player.id,
      amount: -cost,
      details: {
        description: `Posted contract on ${targetName} — ${formatMoney(formReward)} reward plus ${formatMoney(listingFee(formReward))} listing fee`,
      },
      createdAt: new Date().toISOString(),
    } as never);

    addNotification({
      type: 'info',
      title: 'CONTRACT POSTED',
      message: `${targetName} is on the board for ${formatMoney(formReward)}. Everybody can see it.`,
      timestamp: Date.now(),
    } as never);

    soundManager.play('cash_register');
    flash(`POSTED ON ${targetName.toUpperCase()}`);
    setFormTargetId('');
    setFormReward(BOUNTY_CONFIG.MIN_REWARD);
    setFormNote('');
    setFormImage('');
    setTab('mine');
    void poster;
  }, [
    formTargetId, formReward, formTargetKind, formNote, formImage, minReward,
    player, oppContacts, knownSpecialPeople, updateMoney, updateHeat,
    postBounty, addTransaction, addNotification, flash,
  ]);

  // ── Fulfil a contract ──
  const handleProofUpload = useCallback(
    async (file: File) => {
      if (!selected) return;

      const check = canFulfil(selected, player.id);
      if (!check.allowed) {
        flash((check.reason ?? 'CANNOT CASH THIS').toUpperCase());
        return;
      }

      let proofUrl: string;
      try {
        proofUrl = await readFileAsDataUrl(file);
      } catch {
        flash('COULD NOT READ THAT SCREENSHOT');
        return;
      }

      const receipt = fulfilBounty({
        posterId: selected.id,
        hunterPlayerId: player.id,
        hunterGangName: player.gangName ?? 'Your Gang',
        proofImageUrl: proofUrl,
      });

      if (!receipt) {
        flash('CONTRACT NO LONGER AVAILABLE');
        return;
      }

      // You get paid, and you pick up heat for it.
      updateMoney(receipt.reward);
      updateHeat(BOUNTY_CONFIG.HUNTER_HEAT);

      addTransaction({
        id: `tx_bounty_paid_${Date.now()}`,
        type: 'deal_income',
        userId: player.id,
        amount: receipt.reward,
        details: {
          description: `Cashed contract on ${receipt.poster.targetName} — paid by ${receipt.poster.postedByGangName}`,
        },
        createdAt: new Date().toISOString(),
      } as never);

      // The poster becomes your ally too — business runs both directions.
      const alreadyKnown = contacts.some(
        (c) => c.id === `ally_${receipt.poster.postedBy}`,
      );
      if (!alreadyKnown) {
        addContact({
          id: `ally_${receipt.poster.postedBy}`,
          name: receipt.poster.postedByGangName,
          role: 'ally',
          status: 'ally',
          notes: [
            `Paid ${formatMoney(receipt.reward)} for the contract on ${receipt.poster.targetName}.`,
          ],
        } as never);
      }

      addNotification({
        type: 'success',
        title: 'CONTRACT CASHED',
        message:
          `${receipt.poster.postedByGangName} paid ${formatMoney(receipt.reward)} for ${receipt.poster.targetName}. ` +
          `They are in your book as an ally now — and ${receipt.poster.targetGangName} can see who cashed it.`,
        timestamp: Date.now(),
      } as never);

      // The target's gang gets a Get Back window. This is the war starter.
      openWindow({
        trigger: 'bounty_fulfilled',
        lostMemberId: receipt.poster.targetId,
        lostMemberName: receipt.poster.targetName,
        offendingGangName: player.gangName ?? 'Your Gang',
        offendingPlayerId: player.id,
        wantedMemberIds: members.filter((m) => m.status === 'active').map((m) => m.id),
        wantedMemberNames: members.filter((m) => m.status === 'active').map((m) => m.name),
        offenderMoraleGained: 10,
      });

      soundManager.play('cash_register');
      flash(`CASHED ${formatMoney(receipt.reward)}`);
      setSelected(null);
    },
    [
      selected, player, members, contacts, fulfilBounty, updateMoney, updateHeat,
      addTransaction, addContact, addNotification, openWindow, flash,
    ],
  );

  const handleCancel = useCallback(
    (posterId: string) => {
      // Reward is refunded, the listing fee is not. Posting had a cost.
      const p = posters.find((x) => x.id === posterId);
      if (!p) return;
      if (!cancelBounty(posterId)) {
        flash('ALREADY CLOSED');
        return;
      }
      updateMoney(p.reward);
      addTransaction({
        id: `tx_bounty_refund_${Date.now()}`,
        type: 'deal_income',
        userId: player.id,
        amount: p.reward,
        details: {
          description: `Pulled the contract on ${p.targetName} — reward refunded, listing fee kept`,
        },
        createdAt: new Date().toISOString(),
      } as never);
      flash('CONTRACT PULLED — FEE KEPT');
      setSelected(null);
    },
    [posters, cancelBounty, updateMoney, addTransaction, player.id, flash],
  );

  // ── Render ──
  return (
    <div className="mw-root">
      <div className="mw-intro">
        <span className="mw-intro-label">MOST WANTED</span>
        <span className="mw-intro-copy">
          Post a contract, or cash somebody else&rsquo;s. Every payout is public —
          the target&rsquo;s people will know exactly who took the work.
        </span>
      </div>

      <div className="mw-tabs">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            className={`mw-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
            {t === 'board' && openBoard.length > 0 && (
              <span className="mw-tab-count">{openBoard.length}</span>
            )}
            {t === 'mine' && myPosters.filter((p) => p.status === 'open').length > 0 && (
              <span className="mw-tab-count">
                {myPosters.filter((p) => p.status === 'open').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {toast && <div className="mw-toast">{toast}</div>}

      {/* ── THE BOARD ── */}
      {tab === 'board' && (
        <div className="mw-poster-wall">
          {openBoard.length === 0 ? (
            <div className="mw-empty">
              Board is clear. Nobody has anything out on anybody right now.
            </div>
          ) : (
            openBoard.map((p) => (
              <motion.div
                key={p.id}
                className={`mw-poster ${p.postedBy === player.id ? 'own' : ''}`}
                onClick={() => setSelected(p)}
                whileTap={{ scale: 0.98 }}
              >
                <div className="mw-poster-banner">WANTED</div>
                <div className="mw-poster-photo">
                  {p.posterImageUrl ? (
                    <img src={p.posterImageUrl} alt={p.targetName} />
                  ) : (
                    <div className="mw-poster-nophoto">NO PHOTO</div>
                  )}
                </div>
                <div className="mw-poster-name">{p.targetName}</div>
                {p.targetKind === 'special_person' && p.targetOwnerName && (
                  <div className="mw-poster-kin">
                    connected to {p.targetOwnerName}
                  </div>
                )}
                <div className="mw-poster-gang">{p.targetGangName}</div>
                <div className="mw-poster-reward">{formatMoney(p.reward)}</div>
                <div className="mw-poster-meta">
                  <span>{formatRemaining(remainingMs(p))}</span>
                  <span>by {p.postedByGangName}</span>
                </div>
                {p.postedBy === player.id && (
                  <div className="mw-poster-own-flag">YOUR CONTRACT</div>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── MY CONTRACTS ── */}
      {tab === 'mine' && (
        <div className="mw-list">
          {myPosters.length === 0 ? (
            <div className="mw-empty">
              You have not put anything out. Post one from the tab above.
            </div>
          ) : (
            myPosters.map((p) => (
              <div key={p.id} className={`mw-row status-${p.status}`}>
                <div className="mw-row-main">
                  <div className="mw-row-name">{p.targetName}</div>
                  <div className="mw-row-sub">
                    {p.targetGangName} · {formatMoney(p.reward)}
                  </div>
                  {p.status === 'paid' && p.claimedByGangName && (
                    <div className="mw-row-paid">
                      Cashed by {p.claimedByGangName}
                    </div>
                  )}
                </div>
                <div className="mw-row-right">
                  <span className={`mw-status-badge ${p.status}`}>
                    {p.status.toUpperCase()}
                  </span>
                  {p.status === 'open' && (
                    <button className="mw-pull" onClick={() => handleCancel(p.id)}>
                      PULL
                    </button>
                  )}
                  {p.status === 'paid' && p.proofImageUrl && (
                    <button className="mw-view-proof" onClick={() => setSelected(p)}>
                      PROOF
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── POST ONE ── */}
      {tab === 'post' && (
        <div className="mw-form">
          <div className="mw-form-note">
            You can only post on opps already in your contact book. Contracts on a
            member&rsquo;s people cost more and cost you heat — but they crater that
            member&rsquo;s loyalty instead of killing them, which is how somebody flips.
          </div>

          <div className="mw-field">
            <label>TARGET TYPE</label>
            <div className="mw-kind-toggle">
              <button
                className={formTargetKind === 'member' ? 'active' : ''}
                onClick={() => { setFormTargetKind('member'); setFormTargetId(''); }}
              >
                A MEMBER
              </button>
              <button
                className={formTargetKind === 'special_person' ? 'active' : ''}
                onClick={() => { setFormTargetKind('special_person'); setFormTargetId(''); }}
              >
                THEIR PEOPLE
              </button>
            </div>
          </div>

          <div className="mw-field">
            <label>WHO</label>
            {formTargetKind === 'member' ? (
              oppContacts.length === 0 ? (
                <div className="mw-inline-empty">
                  No opps in your book yet. Claim a slide or get slid on first.
                </div>
              ) : (
                <select
                  value={formTargetId}
                  onChange={(e) => setFormTargetId(e.target.value)}
                >
                  <option value="">Select an opp</option>
                  {oppContacts.map((c) => (
                    <option key={c.id} value={c.memberId ?? c.id}>
                      {c.nickname ? `${c.name} "${c.nickname}"` : c.name}
                      {c.level ? ` — lvl ${c.level}` : ''}
                    </option>
                  ))}
                </select>
              )
            ) : knownSpecialPeople.length === 0 ? (
              <div className="mw-inline-empty">
                You do not know anybody&rsquo;s people yet. Open an opp&rsquo;s contact
                card to learn who they care about.
              </div>
            ) : (
              <select
                value={formTargetId}
                onChange={(e) => setFormTargetId(e.target.value)}
              >
                <option value="">Select a person</option>
                {knownSpecialPeople.map(({ person, ownerName }) => (
                  <option key={person.id} value={person.id}>
                    {person.name} — {RELATION_LABELS[person.relation]} of {ownerName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mw-field">
            <label>PHOTO ON THE POSTER</label>
            <input
              ref={posterImageRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setFormImage(await readFileAsDataUrl(f));
                } catch {
                  flash('COULD NOT READ THAT IMAGE');
                }
              }}
            />
            <button className="mw-upload" onClick={() => posterImageRef.current?.click()}>
              {formImage ? 'CHANGE PHOTO' : 'UPLOAD PHOTO'}
            </button>
            {formImage && (
              <div className="mw-preview">
                <img src={formImage} alt="poster preview" />
              </div>
            )}
          </div>

          <div className="mw-field">
            <label>
              REWARD
              {formTargetId && (
                <span className="mw-min-hint"> · min {formatMoney(minReward)}</span>
              )}
            </label>
            <input
              type="number"
              min={BOUNTY_CONFIG.MIN_REWARD}
              max={BOUNTY_CONFIG.MAX_REWARD}
              step={500}
              value={formReward}
              onChange={(e) => setFormReward(Number(e.target.value) || 0)}
            />
            <div className="mw-fee-line">
              Listing fee {formatMoney(listingFee(formReward))} · total out of pocket{' '}
              <strong>{formatMoney(totalPostingCost(formReward))}</strong>
            </div>
          </div>

          <div className="mw-field">
            <label>NOTE (OPTIONAL)</label>
            <textarea
              rows={2}
              maxLength={140}
              placeholder="Where they post up, what time, anything useful."
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
            />
          </div>

          <button className="mw-post-btn" onClick={handlePost}>
            POST CONTRACT · {formatMoney(totalPostingCost(formReward))}
          </button>
        </div>
      )}

      {/* ── ALLIES ── */}
      {tab === 'allies' && (
        <div className="mw-list">
          <div className="mw-form-note">
            Allies come out of business, not friendship. Anyone who cashes your
            contract lands here. Standing rises with every job you do together.
          </div>
          {allies.length === 0 ? (
            <div className="mw-empty">
              No allies yet. Somebody has to cash one of your contracts first.
            </div>
          ) : (
            allies.map((a) => (
              <div key={a.id} className="mw-row">
                <div className="mw-row-main">
                  <div className="mw-row-name">{a.gangName}</div>
                  <div className="mw-row-sub">
                    {a.jobsCompleted} job{a.jobsCompleted === 1 ? '' : 's'} ·{' '}
                    {formatMoney(a.moneyExchanged)} exchanged
                  </div>
                </div>
                <div className="mw-row-right">
                  <div className="mw-standing">
                    <div className="mw-standing-track">
                      <div
                        className="mw-standing-fill"
                        style={{ width: `${a.standing}%` }}
                      />
                    </div>
                    <span className="mw-standing-val">{a.standing}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Detail modal ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="mw-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="mw-modal"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mw-modal-banner">
                {selected.status === 'paid' ? 'CLOSED' : 'WANTED'}
              </div>

              <div className="mw-modal-photo">
                {selected.posterImageUrl ? (
                  <img src={selected.posterImageUrl} alt={selected.targetName} />
                ) : (
                  <div className="mw-poster-nophoto">NO PHOTO ON FILE</div>
                )}
              </div>

              <h3>{selected.targetName}</h3>
              <div className="mw-modal-gang">{selected.targetGangName}</div>

              {selected.targetKind === 'special_person' && selected.targetOwnerName && (
                <div className="mw-modal-kin">
                  {RELATION_LABELS[
                    (knownSpecialPeople.find((x) => x.person.id === selected.targetId)
                      ?.person.relation ?? 'cousin')
                  ]}{' '}
                  of {selected.targetOwnerName}
                </div>
              )}

              <div className="mw-modal-reward">{formatMoney(selected.reward)}</div>

              {selected.note && <p className="mw-modal-note">{selected.note}</p>}

              {selected.lastKnownAddress && (
                <div className="mw-modal-loc">
                  Last seen around {selected.lastKnownAddress}
                </div>
              )}

              <div className="mw-modal-meta">
                <span>Posted by {selected.postedByGangName}</span>
                <span>{formatRemaining(remainingMs(selected))}</span>
              </div>

              {selected.status === 'paid' ? (
                <div className="mw-modal-closed">
                  <div className="mw-closed-line">
                    Cashed by {selected.claimedByGangName}
                  </div>
                  {selected.proofImageUrl && (
                    <div className="mw-proof-shot">
                      <div className="mw-section-label">PROOF SUBMITTED</div>
                      <img src={selected.proofImageUrl} alt="proof" />
                    </div>
                  )}
                </div>
              ) : selected.postedBy === player.id ? (
                <>
                  <div className="mw-modal-own">
                    This is your contract. Pull it and the reward comes back — the
                    listing fee does not.
                  </div>
                  <button className="mw-pull-btn" onClick={() => handleCancel(selected.id)}>
                    PULL CONTRACT
                  </button>
                </>
              ) : (
                <>
                  <div className="mw-fulfil-note">
                    Handle it, screenshot the confirmed win, then upload it here.
                    Payment is automatic — and public.
                  </div>
                  <input
                    ref={proofInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleProofUpload(f);
                    }}
                  />
                  <button
                    className="mw-cash-btn"
                    onClick={() => proofInputRef.current?.click()}
                  >
                    UPLOAD PROOF &amp; CASH {formatMoney(selected.reward)}
                  </button>
                </>
              )}

              <button className="mw-close" onClick={() => setSelected(null)}>
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MostWanted;
