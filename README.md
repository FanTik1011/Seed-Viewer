# SeedMap

Interactive Minecraft Java seed map powered by Cubiomes through a small Flask API.

## MVP Status

Implemented:

- Seed input and random seed generation
- Java Edition version selector for 1.16 through 1.21
- Overworld map generation for the selected seed
- Biome tile streaming with canvas pan and zoom
- X/Z cursor coordinates, selected-location panel, coordinate copy, and `/tp` copy
- Shareable URLs such as `/?seed=12345&version=1.21&dimension=overworld&x=0&z=0&zoom=1&load=1`
- Layer toggles for biomes, grid, axes, spawn, strongholds, and structures
- Web Worker for biome, structure, random seed, capability, and seed-search API calls
- Cubiomes-backed structure markers, including the MVP-required:
  - villages
  - strongholds
  - ancient cities
  - spawn point / estimated spawn
- Extra Cubiomes structures where supported by the current native library:
  - monuments, mansions, outposts
  - desert temples, jungle temples, witch huts, igloos
  - ocean ruins, shipwrecks, buried treasure, mineshafts, desert wells
  - ruined portals, geodes, trail ruins, trial chambers
  - Nether fortresses and bastions

Dimension support:

- Overworld is fully supported by the bundled native library.
- Nether structures are supported. Nether biomes require rebuilding `libseedmap` from the updated `cubiomes_wrapper.c`.
- End structures and End biomes require rebuilding `libseedmap` from the updated `cubiomes_wrapper.c`.

## Project Structure

```text
seedmap/
  app.py
  cubiomes_wrapper.c
  libseedmap.so
  libseedmap.dll
  Procfile
  requirements.txt
  .python-version
  static/
    app.js
    seed-worker.js
    styles.css
  templates/
    index.html
```

## Local Run

```bash
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`.

On Windows the app loads `libseedmap.dll`. On Heroku/Linux it loads `libseedmap.so`.

## Rebuild Native Library

Only needed if you change `cubiomes_wrapper.c` or want full Nether/End biome and End-structure support.

Linux/Heroku-compatible build:

```bash
gcc -O3 -fPIC -shared -o libseedmap.so cubiomes_wrapper.c cubiomes/*.c -lm
```

Windows DLL build, if you have MinGW:

```bash
gcc -O3 -shared -o libseedmap.dll cubiomes_wrapper.c cubiomes/*.c
```

Commit the rebuilt `libseedmap.so` before deploying to Heroku.

## Deploy To Heroku From GitHub

This repo is already configured for Heroku with:

- `requirements.txt`
- `Procfile`
- `.python-version`
- `.slugignore`
- `libseedmap.so` for Linux dynos

Steps:

1. Create a GitHub repository and push this project.

```bash
git init
git add .
git commit -m "Initial SeedMap MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

2. Open the Heroku Dashboard and create a new app.
3. In the app, open the Deploy tab.
4. Choose GitHub as the deployment method.
5. Connect your GitHub account and select the repository.
6. Enable automatic deploys from `main`, or click Manual deploy.
7. Open the app after the build finishes.

Heroku CLI alternative:

```bash
heroku login
heroku create your-seedmap-name
heroku git:remote -a your-seedmap-name
git push heroku main
heroku open
```

Important Heroku notes:

- Keep `libseedmap.so` committed, because Heroku runs Linux.
- Do not commit `venv/`, logs, `__pycache__/`, or `libseedmap.dll`.
- If the app crashes on Heroku, check logs:

```bash
heroku logs --tail
```

## API

| Endpoint | Description |
|---|---|
| `GET /api/capabilities` | Returns supported dimensions/features for the loaded native library |
| `GET /api/random_seed` | Returns a random numeric seed |
| `GET /api/spawn?seed=&version=` | Returns Overworld spawn X/Z |
| `GET /api/strongholds?seed=&version=&count=` | Returns Overworld stronghold positions |
| `GET /api/biomes?seed=&version=&dimension=&x=&z=&w=&h=&scale=` | Returns biome grid |
| `GET /api/structures?seed=&version=&dimension=&type=&x=&z=&w=&h=` | Returns positions for one structure type |
| `GET /api/all_structures?seed=&version=&dimension=&x=&z=&w=&h=` | Returns markers for the selected dimension |
| `GET /api/search_seeds?version=&attempts=&radius=&required=` | Finds random seeds with selected structures near spawn |

## References

- Heroku GitHub integration: https://devcenter.heroku.com/articles/github-integration
- Heroku Python support: https://devcenter.heroku.com/categories/python-support
- Cubiomes: https://github.com/Cubitect/cubiomes

## License

- Cubiomes: MIT License
- This tool: MIT License
