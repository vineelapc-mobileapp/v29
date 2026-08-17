# EEE Practice App — v29

Fixes the exact problem you hit: Publish to GitHub silently failing (or
appearing to hang for 15-20 minutes) with no clear reason, and no way to
recover the work you'd just done.

## What was actually wrong

GitHub's Contents API - the specific endpoint Publish to GitHub uses -
has a much stricter limit than normal Git: roughly 1 MB per write,
separate from GitHub's general 100 MB file limit. This is a real,
documented GitHub limitation, not a bug in the app's code. With video
files embeddable up to 15 MB (from v28), a question with a video attached
can easily push `questions.json` over that 1 MB write limit - and the
previous version's error handling was too easy to miss, so it looked like
publishing just silently did nothing.

The 15-20 minute empty "Verify Uploaded Data" you saw was your app
correctly showing what's actually live on GitHub - since Publish never
actually succeeded, nothing new was ever there to show. No amount of
waiting would have fixed it; the request itself was being rejected.

## What's fixed

1. Checked before attempting, not after failing. Publish now checks
your question bank's size before touching the network. If it's over the
limit, you get an immediate, clear explanation - no more waiting, no more
guessing why nothing happened.

2. Impossible to miss. Any publish failure now shows as a blocking
popup you have to dismiss, not just a small colored line of text that's
easy to miss while scrolling on a phone.

3. File size shown proactively. The "Verify Uploaded Data" Overview
now always shows your current question bank's size, turning red once it
gets close to the limit - so you can see it coming before you even hit
Publish.

4. Your work is never silently lost again. This is the bigger fix.
Whatever you're working on in Upload Questions now auto-saves locally on
your device as you go. If Publish fails, you accidentally close the tab,
or your browser crashes, reopening Teacher Upload now offers to restore
your unsaved work exactly where you left off.

## What to do if you hit the size limit

The error message itself walks you through it, but in short:

1. Tap "Download File" instead of Publish - this always works
   regardless of size, since it just saves to your device.
2. On github.com, open your repo → data folder → click questions.json
   → pencil (edit) icon → replace its content with the downloaded file →
   Commit. GitHub's website upload/edit accepts files up to 25 MB this
   way, well above the 1 MB API limit Publish hits.
3. Going forward, keep video uploads to genuinely short clips, or use a
   Link (YouTube/Drive) for anything longer - the Link barely adds any
   size to the file at all.

## Verified before shipping

Tested the actual failure scenario directly: seeded a question bank over
the 1 MB threshold, confirmed Publish blocks with zero network calls made
(not a failed request - no request at all) and shows the clear popup.
Also tested the full draft-recovery cycle: started a question in one
browser session, closed it without publishing, reopened Teacher Upload,
and confirmed the "Restore" banner appeared with the exact unsaved work
intact.

## Changelog

### v29 — Fix: Publish silently failing on large files, safety-net drafts
- **<span style="color:red">**\*NEW\*** Pre-flight size check before Publish</span>** - blocks with a clear, actionable explanation instead of a silent/confusing failure.
- **<span style="color:red">**\*NEW\*** Publish failures shown as a blocking popup</span>**, not just an easy-to-miss status line.
- **<span style="color:red">**\*NEW\*** File size shown in Verify Uploaded Data</span>**, turning red as it approaches the limit.
- **<span style="color:red">**\*NEW\*** Automatic local draft saving + restore</span>** - work in progress is never silently lost to a failed publish, a closed tab, or a crash again.
- No changes to question editing, video upload, math rendering, or anything else from v28.

## Still pending

- Real question content for the syllabus topics
- Bring back "Ask a Doubt" once students are onboarded (from v17)
- Firebase backend for Student Marks + Doubts tabs (still your call — see v10)
- Level-2 unlock gated on Level-1 score
- Desktop `.exe` project not yet synced past v7
