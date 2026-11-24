# Private browsing checklist (TD-16.1)

Five steps on a real phone. Do them once in iOS Safari private, and
once in Android Chrome private. Use the live site. Start from a
phone that already has an age band and some subject progress saved
in the normal (not private) profile, so step 5 can prove the two
profiles do not mix.

What "good" means when storage refuses a write: the page never
crashes, the picked age band still applies until the tab is
reloaded, and subject progress is not shown as saved. That is the
storage port's contract. A reload after a refused write shows the
three band pills again, because the in-memory band does not
outlive the document.

iOS Safari private often refuses Web Storage (a write throws, or
the quota is zero). Android Chrome private usually accepts writes
for the life of the private session and drops them when the last
private tab closes. The expected line for each step says which.

The same refusal, without a phone, is `tests/e2e/private-browsing.spec.ts`.

## 1. Open a fresh private tab

iOS Safari: open Safari, switch to Private, and open the site in a
new private tab. The address bar shows Private.

Android Chrome: open Chrome, choose New Incognito tab, and open the
same address. The incognito mark is showing.

Expected, iOS Safari private: Home loads. There is no error screen.
Why Do We Learn This? shows three pills — Ages 7-10, Ages 10-18,
Ages 18+ — and no selected-band pill. The normal profile's band
is not here.

Expected, Android Chrome private: the same. Home loads, no error
screen, three band pills, nothing carried over from the normal
profile.

## 2. Pick Ages 7-10, leave, and come back

On Why Do We Learn This?, tap Ages 7-10. Tap Meridian home. Open
Why Do We Learn This? again. Do not close the private tabs.

Expected, iOS Safari private: the three pills collapse to one pill
reading Ages 7-10, and the page says Ages 7-10. After Home and
returning, that same pill is still there. If this iOS version
refuses the storage write, the pill still reads Ages 7-10 for the
rest of this visit. No error screen.

Expected, Android Chrome private: the same pill, still Ages 7-10
after leaving and returning. Chrome keeps the write for this
incognito session. No error screen.

## 3. Solve one Math case

Open Math. Answer the first case correctly. Wait until the result
says "You got it!". Go back to Why Do We Learn This?.

Expected, iOS Safari private: the case finishes and shows "You got
it!". The page does not crash. Then look at Math's Reset control.
If storage accepted the write, Reset is enabled. If storage refused
the write, Reset stays disabled — the solve was not saved, and the
screen does not claim that it was. A blank page or a stuck spinner
is a failure either way. The Ages 7-10 pill is still showing.

Expected, Android Chrome private: the case shows "You got it!",
Math's Reset is enabled, and the Ages 7-10 pill is still showing.
No error screen.

## 4. Reload the private tab

Reload the same private tab. Open Why Do We Learn This? again.

Expected, iOS Safari private: Home loads again, no error screen.
If storage accepted the writes, Ages 7-10 is still selected and
Math's Reset is still enabled. If storage refused the writes, the
three pills are back and Math's Reset is disabled. Both of those
are acceptable. A crash is not.

Expected, Android Chrome private: after the reload, Ages 7-10 is
still selected and Math's Reset is still enabled. No error screen.
Incognito keeps site data across a reload until the session ends.

## 5. End the private session, then check both profiles

Close every private tab so the private session actually ends.
Open a new private tab and open the site again. Then open the site
in a normal tab on the same phone.

Expected, iOS Safari private: the new private tab shows the three
band pills, and Math's Reset is disabled. Nothing from steps 2–4
remains. The normal tab still has the band and the progress that
were there before step 1. Private browsing did not clear them and
did not copy them.

Expected, Android Chrome private: the same. A new incognito tab
starts empty (three pills, Math Reset disabled). The normal Chrome
profile still has its own band and progress, untouched.
