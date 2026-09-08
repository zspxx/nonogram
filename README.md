# Nonogram

A minimalist 7×7 nonogram (picross) puzzle game. Endless puzzles, three mistakes
per puzzle, and no accounts, servers, or tracking — it is three static files and
your browser.

Play it by opening `index.html`, or publish it for free with GitHub Pages using
the step-by-step guide below.

---

## How to play

Each row and column has clues describing the runs of filled cells in it. `2 2`
means a run of two filled cells, a gap of at least one, then another run of two.
`0` means the line is empty. Work out which cells are filled using the clues
alone.

- **Fill** a cell you believe is filled.
- **Mark X** on a cell you believe is empty. X marks are your notes.
- A clue is struck through once your board satisfies it.
- You win when every filled cell is filled. You do **not** need to X the empty
  ones — the game completes the board for you when you win.
- Three mistakes ends the puzzle. Filling a cell that should be empty, or
  crossing a cell that should be filled, each cost one mistake.

### Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Fill | Left click, or drag across cells | Tap, or drag across cells in **Fill** mode |
| Mark X | Right click, or switch to **Mark X** mode | Switch to **Mark X** mode, then tap or drag |
| Erase | Click a filled cell / right-click an X | Tap it again in the matching mode |

Right-click is only a shortcut — everything is playable with the Fill / Mark X
buttons alone.

**Keyboard:** Tab to the grid, move with the arrow keys, `Enter` or `Space` acts
in the current mode, and `X` marks a cell.

---

## Running it on your own computer

Download or clone the files and double-click `index.html`. That is all — there
is no build step, no dependencies, and nothing to install.

---

## Putting it on the internet with GitHub Pages

GitHub Pages hosts static websites for free. This walkthrough assumes you have
never deployed a site before. You will need a free
[GitHub account](https://github.com/signup).

### Step 1 — Create a repository

1. Go to [github.com/new](https://github.com/new).
2. Under **Repository name**, type a name, for example `nonogram`. Remember what
   you typed — it becomes part of your website address.
3. Choose **Public**. (GitHub Pages is free for public repositories.)
4. Leave "Add a README file" unticked — this project already has one.
5. Click **Create repository**.

### Step 2 — Upload the files

The easiest way, with no commands to type:

1. On your new empty repository page, click **uploading an existing file**.
2. Drag these files into the browser window:
   - `index.html`
   - `styles.css`
   - `script.js`
   - `README.md`
   - `.gitignore`
3. Scroll down, type a short message such as `Add nonogram game`, and click
   **Commit changes**.

<details>
<summary>Prefer the command line? Click here.</summary>

From inside the project folder:

```bash
git init
git add .
git commit -m "Add nonogram game"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/nonogram.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username and `nonogram` with your
repository name.

</details>

**Important:** the files must sit at the top level of the repository, not inside
a subfolder. `index.html` should be visible on the repository's front page.

### Step 3 — Turn on GitHub Pages

1. In your repository, click the **Settings** tab (top right, next to Insights).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
4. Under **Branch**, pick `main`, leave the folder as **/ (root)**, and click
   **Save**.

### Step 4 — Open your website

Wait about one minute, then reload the Settings → Pages screen. A banner appears
with your address. If your username is `janedoe` and the repository is
`nonogram`, it will be:

```
https://janedoe.github.io/nonogram/
```

That link is public — share it with anyone. If you get a 404 at first, wait a
minute and reload; the first deployment takes a moment.

### Updating the site later

```
Edit the files  →  Commit the changes  →  Push to GitHub  →  Pages updates itself
```

In the browser: open the file in your repository, click the pencil icon, edit,
then **Commit changes**. On the command line: `git add .`, `git commit -m "..."`,
`git push`. Your live site refreshes within a minute or so — you may need a hard
reload (`Ctrl`/`Cmd` + `Shift` + `R`) to get past your browser's cache.

### Getting a clean URL without your username

The default Pages address contains your username
(`https://YOUR-USERNAME.github.io/nonogram/`). There are two ways around that.

**Option A — a GitHub organization (free, no purchase, no DNS).**
A repository named `<name>.github.io` inside an organization called `<name>` is
served at `https://<name>.github.io/` — your personal username appears nowhere
in the address.

1. Go to [github.com/organizations/plan](https://github.com/organizations/plan)
   and choose the **Free** plan.
2. Name the organization after the game, e.g. `playnonogram`.
3. Inside that organization, create a repository named exactly
   `playnonogram.github.io` (organization name + `.github.io`).
4. Upload the files and enable Pages exactly as in Steps 2–3 above.
5. Your site is `https://playnonogram.github.io/`.

**Option B — your own domain (costs money, ~$10–40/year).**

1. Buy a domain from any registrar (Namecheap, Cloudflare, Porkbun, GoDaddy…).
2. In your repository: **Settings → Pages → Custom domain**, type the domain,
   click **Save**. GitHub adds a `CNAME` file to the repository for you.
3. At your registrar's DNS panel, add these records:

   | Type | Name | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153` |
   | AAAA | `@` | `2606:50c0:8001::153` |
   | AAAA | `@` | `2606:50c0:8002::153` |
   | AAAA | `@` | `2606:50c0:8003::153` |
   | CNAME | `www` | `YOUR-USERNAME.github.io.` (or `<org>.github.io.`) |

   Use the `A`/`AAAA` rows for a bare domain (`example.com`); the `CNAME` row
   covers `www.example.com`.
4. DNS can take anywhere from a few minutes to a day to propagate. When the
   check passes, tick **Enforce HTTPS** in Settings → Pages.

### You only need one website

You do **not** need a separate site per player. One public address is enough:
every visitor's browser keeps its own game. One person can be on Puzzle #4 with
one mistake while another is on Puzzle #17 with none, on the same URL.

---

## Privacy

- No accounts, logins, or passwords.
- No database, no server-side code, no API keys.
- No analytics, tracking, cookies, or third-party scripts.
- Nothing is collected or sent anywhere.

Your progress lives in your own browser's `localStorage`, under the key
`nonogram-7x7-v1`. It holds only the puzzle number, the current puzzle and board,
and your mistake count.

Because it is stored per browser, your progress does **not** follow you between
devices, or between Chrome and Safari on the same device, or into a private
window. Each starts fresh at Puzzle #1. Syncing across devices would require
accounts and a backend, which this project deliberately does not have. Clearing
your browsing data clears your progress.

---

## Project layout

```
index.html    Page structure
styles.css    All styling
script.js     Game logic
README.md     This file
.gitignore    Files Git should ignore
```

Asset paths are relative (`styles.css`, `script.js`), so the site works both at a
domain root and inside a repository subpath such as `/nonogram/`.

`script.js` is organised in two halves. The first is pure logic with no DOM
access — seeded random numbers, clue maths, a line solver, puzzle generation,
clue-completion and win detection. The second is the game layer — state,
storage, rendering, pointer and keyboard input, dragging, mistakes, the final
reveal, and the reset / next-puzzle flow.

### About the puzzles

Puzzles are generated, not stored in a list, so the sequence is effectively
endless. Every generated board is checked before you see it: it must have
exactly one solution, and it must be solvable by ordinary line-by-line
reasoning. You should never have to guess.

---

## Browser support

Any current version of Chrome, Firefox, Safari or Edge, on desktop or mobile.
The game uses Pointer Events, CSS grid, and `localStorage`. It respects the
system "reduce motion" setting: with it on, animations are skipped and the game
still plays normally.
