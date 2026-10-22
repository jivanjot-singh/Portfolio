# Video editing portfolio

Three views (Home, Edits, Contact) in one static site. No build step, no accounts, no dependencies.
Open `index.html` in a browser to preview it. The placeholder clips in `media/` and the placeholder
portrait in `assets/me.jpg` are there so you can see it working. Replace them with yours.

```
index.html          the page shell
css/style.css       colours and fonts (the three colours are at the top)
js/app.js           routing, players, arrows, starring
data/site.js        YOUR settings: name, photo, WhatsApp, Instagram, captions
data/videos.js      your videos (written by optimize.py, titles and stars editable)
raw/                drop your huge original exports here (short / long / colour)
media/              optimized videos + posters (created by optimize.py)
optimize.py         the optimizer
```

## 1. Add your videos (the part that fixes the huge file sizes)

1. Install ffmpeg once (`winget install ffmpeg` on Windows, `brew install ffmpeg` on Mac).
2. Copy your original exports into `raw/short/`, `raw/long/` and `raw/colour/`.
3. Run `python optimize.py` (Mac/Linux: `python3 optimize.py`).

For each file it creates an MP4 capped at 1080p with a bitrate ceiling, a poster image, and a new
entry in `data/videos.js`. Re-running only processes new files. Use `--height 720` for lighter files.

Why this loads fast:
- The big original never goes on the website. A 1 GB export is usually a small fraction of that after re-encoding.
- The MP4 is laid out so it starts playing before it has fully downloaded.
- Visitors see a poster image first. No video data is requested until they hover or press play.
  Only one video plays at a time.

Titles come from file names. Edit them in `data/videos.js`. Order inside a category follows the order in that file.

## 2. Fill in your details

Open `data/site.js` and replace the WhatsApp number (`https://wa.me/<country code><number>`, digits only)
and the Instagram link. Swap `assets/me.jpg` for your photo. It is blurred, so a 1280px wide JPEG
under 100 KB is enough.

## 3. Choose the starred videos (the ones on the home page)

Open the site once with `#owner` on the end of the address (for example `yoursite.com/#owner`).
Every video on the Edits page gets a star button, only for you, in that browser. One star per category.
Click **Copy videos.js**, paste it over `data/videos.js`, and deploy. Visitors then see your picks.
Until you do that, starring only changes what you see in your own browser.

You can also set `"starred": true` by hand in `data/videos.js`.

## 4. Put it online

Static hosts limit single files. Cloudflare Pages, for example, allows at most 25 MiB per file, so the
videos need their own storage with a CDN, and the site itself goes on any free static host.

- Site files (`index.html`, `css/`, `js/`, `data/`, `assets/`): Cloudflare Pages, Netlify or GitHub Pages.
- Videos and posters (`media/`): Cloudflare R2 with a public domain, or Bunny Storage + CDN. Check each
  provider's current pricing and limits.
- After uploading `media/`, set `mediaBase` in `data/site.js` to its address, for example
  `"https://media.yourdomain.com/"`. Do not upload the `raw/` folder.

The host must support byte-range requests (all of the above do). That is what lets a video start playing
and let people skip ahead without downloading the whole file.

## Notes

- The text colour `#fca311` on white is low contrast (roughly 1.9:1), so small text in it is hard to read for many people.
  Headings and captions are large and heavy to compensate. If you want to adjust it later, change `--amber`
  at the top of `css/style.css`.
- Category ids (`short`, `long`, `colour`) in `data/site.js` and the folder names must stay as they are. Captions and labels can change freely.
- Colour-graded work: ffmpeg converts to standard 8-bit video. If you grade HDR or log footage and want it shown exactly as graded, export a Rec.709 file first.
