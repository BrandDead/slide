# Photo-to-member likeness

Players can put a friend on their crew by uploading a photo. The promise is
**the resulting character looks like that person**, not like a stock dealer.

## What happens now

1. The player uploads a photo in Contacts → Add → Create from Photo (or Phone).
2. They must check three consents: adult photo, permission from the person, and
   processing to make a fictional game character.
3. The backend analyzes the photo (skin tone, hair, facial hair, clothing) and
   composites a SLIDE character card that **keeps the uploaded face**.
4. Only generated card URLs are stored on the roster. The source photo is deleted
   from the server after the job finishes.

If the Flask API is down, the browser does the same thing locally with an SVG
card that still embeds the uploaded photo. It will **not** silently swap in
stock role art.

## Optional AI restyle (not required)

The default path does not call an image model. To try a stylized 2.5D restyle
that still asks the model to preserve the face:

```
# backend/python/.env
OPENAI_API_KEY=sk-...
SLIDE_AVATAR_PROVIDER=openai
SLIDE_AVATAR_MODEL=gpt-image-1
```

Also install the optional client in the backend venv:

```
./venv/bin/pip install 'openai>=1.40.0'
```

`GET /api/avatar/provider` reports whether that path is live. If the key,
package, or model call fails, generation falls back to the local photo card
and returns `aiProviderError`. It does not invent a different person.

Owner decisions still needed:

- Which image vendor (OpenAI vs another) and who pays for it.
- Private durable storage for generated cards (today: in-memory job + data URL
  on the local roster). Do not put source photos or public signed URLs in git.
- Whether AI restyle is offered at all for the first public cohort.

## Safety

- 18+ only. The UI and API reject the job without adult + permission +
  processing consent.
- Cosmetic fictional avatar only. Not a real-world claim or targeting feature.
- Canonical world/rival art stays wholly fictional.
- Do not commit founder photos or generated likenesses to the repository.

See issue #195 and the fictional-content contract in
`docs/AI_CONTRIBUTOR_START_HERE.md`.
