# Photo-to-member likeness (GPT Image)

Players can put a friend on their crew by uploading a photo. The owner
target is **GTA V loading-screen / cover-art illustrated realism** — the
same person, believable proportions and clothing, one look across
portrait, full-body, and in-game states.

Vector, South Park, clip-art, and stick-figure bodies are not a valid
fallback. If GPT Image is not configured, the roster shows the **real
photo crop** and the body is labeled **locked**.

## What happens now

1. The player uploads a photo in Contacts → Add → Create from Photo (or Phone).
2. They must check three consents: adult photo, permission from the person, and
   processing to make a fictional game character.
3. The backend analyzes the photo (skin, hair, facial hair) only to write the
   GPT Image identity prompt. The source file is then deleted.
4. Only generated asset URLs (or the photo crop) are stored on the roster.
   The source photo is never persisted there.

| `OPENAI_API_KEY` | Portrait | Body / token |
|---|---|---|
| unset | Real photo crop | Locked — not generated |
| set, GPT Image succeeds | GTA-style likeness of that person | Same look, generated |
| set, GPT Image fails | Real photo crop + `aiProviderError` | Locked — never a stick figure |

If Flask is down, the browser still shows the photo crop and locks the body.
It will **not** swap in stock role art or draw a vector body.

## How to enable GPT Image

The key is **not** set in this environment yet. The owner will provide it.
No other vendor flag is required.

```bash
# 1. Put the key in the Flask env (backend/python/.env). Never commit it.
OPENAI_API_KEY=sk-...

# 2. Optional pin. If unset, the server tries latest-first:
#    gpt-image-2 → gpt-image-1.5 → gpt-image-1
# SLIDE_AVATAR_MODEL=gpt-image-2

# 3. Install the client in the backend venv.
cd backend/python
./venv/bin/pip install 'openai>=1.40.0'

# 4. Restart Flask so it rereads the env.
./venv/bin/python app.py
```

Then check:

```bash
curl -s http://127.0.0.1:5000/api/avatar/provider
```

Ready looks like:

```json
{
  "provider": "gpt_image",
  "aiConfigured": true,
  "bodyLockedUntilConfigured": false,
  "model": "gpt-image-2"
}
```

Not ready (current default) looks like:

```json
{
  "provider": "photo_crop",
  "aiConfigured": false,
  "bodyLockedUntilConfigured": true,
  "requiredForAi": { "env": ["OPENAI_API_KEY"] }
}
```

`SLIDE_AVATAR_PROVIDER` is no longer required. DALL·E 2 / DALL·E 3 are
never used, even if someone puts those names in `SLIDE_AVATAR_MODEL`.

The frontend does not need an OpenAI key. It talks to Flask at
`VITE_API_URL` (default `http://localhost:5000`). After changing
`frontend/.env`, restart Vite — `VITE_*` values are compile-time.

## Safety

- 18+ only. The UI and API reject the job without adult + permission +
  processing consent.
- Cosmetic fictional avatar only. Not a real-world claim or targeting feature.
- Canonical world/rival art stays wholly fictional.
- Do not commit founder photos, generated likenesses, or the API key.

See issue #195 and the fictional-content contract in
`docs/AI_CONTRIBUTOR_START_HERE.md`.
