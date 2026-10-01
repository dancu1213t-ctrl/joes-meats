# Joe’s Meats — website and admin

Upload the CONTENTS of this folder to a GitHub repository. Keep `render.yaml`, `app.py`, and `index.html` at the repository root. Do not upload the ZIP itself.

## Go live

1. Create a GitHub repository (private is fine). Extract the ZIP and upload all files and the complete `assets` folder, preserving the folders. Include `.gitignore` if uploading with Git.
2. In [Render](https://dashboard.render.com/), select **New → Blueprint**, connect GitHub, and choose your repository. Render reads `render.yaml`.
3. When prompted for `ADMIN_PASSWORD`, choose a unique password with 12–200 characters and save it in your password manager. This is your online admin password. The previous local password is not bundled.
4. Review the paid Starter service and 1 GB persistent disk, then deploy. This is not a free-hosting configuration. See [Render pricing](https://render.com/pricing).
5. Once the deployment is live, open the HTTPS URL Render provides. Add `/admin` to that URL and sign in with the password from step 3.

GitHub stores the code. GitHub Pages alone cannot run the Python admin API or save shared edits. The included Render setup runs the whole site, including cart and admin.

## Custom domain

Add your domain in Render’s service settings and follow its DNS instructions. Then add an environment variable `PUBLIC_ORIGIN` containing the exact canonical HTTPS address, for example `https://www.your-domain.com` (no trailing slash). Redeploy, and use that address to sign in. Without this variable, admin requests are accepted only from your Render HTTPS address.

## What is included

- Latest saved website content, product prices, images, local fonts, white layout and mobile styles.
- Home/category sliders, store directions, Facebook and Instagram links.
- Quantity cart, BZD totals and store-specific WhatsApp order requests.
- Admin editing for products, prices, slider images, store information and page copy.
- Production Flask/Gunicorn server, Render configuration and deployment tests.

WhatsApp opens a prepared message for the customer to send. The cart resets when handed off to WhatsApp; the browser cannot verify that the customer pressed Send. Orders are not stored on this server. Confirm live product prices, units, availability and both store numbers before accepting customer orders.

## Persistent data and backups

Production changes are saved under `/var/data/joes-meats`, including `site.json`, `previous.json`, and `uploads/`. The Render disk keeps these through restarts and deploys. Do not remove the disk. Saved content takes precedence over `site-defaults.json` after the first admin save.

Back up this entire data directory using Render’s disk/SSH tools. Admin JSON exports contain text and image paths, not the image files themselves. Render also provides disk snapshots: https://render.com/docs/disks.

Run exactly one Gunicorn worker and one service instance as configured: the file locks and login sessions are process-local. A restart signs admins out; it does not erase saved content. Change `ADMIN_PASSWORD` in Render and redeploy to rotate the password. The login endpoint limits failed attempts globally to eight per five minutes.

## Local preview

With Python installed, run `python server.py --port 8765` or double-click `start-website.cmd` on Windows. Open http://127.0.0.1:8765. The local admin creates its own separate password at `/admin`; local data is ignored by Git. This local preview uses its own `private` directory, not the Render disk.

## Test the production application

Install Flask (`python -m pip install Flask==3.1.2`) and run `python test_deployment.py`. The tests use temporary data and never contact WhatsApp. Gunicorn is installed by Render on Linux; it is not required for the Windows preview or these tests.

After deploying, check the public homepage on a phone, both store links, cart calculations and admin save/upload. This package was tested locally; your GitHub/Render accounts and custom DNS have not been configured by this package.

No admin password, authentication hash, private backup or local session is included in this repository.
