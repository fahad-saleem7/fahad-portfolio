# Fahad Saleem — Portfolio

Personal portfolio website built with vanilla HTML, CSS, and JavaScript.

## Files

| File | Size | Purpose |
|------|------|---------|
| `index.html` | ~41 KB | Main HTML structure |
| `style.css` | ~44 KB | All styles + gradient background |
| `app.js` | ~11 KB | All JavaScript + IndexedDB storage |

**Total: ~96 KB** (well under GitHub's limits)

## Features

- ✏️ Password-protected edit mode (`fahad123` — change in `app.js`)
- 📷 Profile photo upload with lightbox viewer
- 🎓 Certifications with certificate image upload
- 📄 Resume & CV upload (no size limit — uses IndexedDB)
- 🎨 Animated gradient background
- ✨ Click highlight on all interactive elements
- 💾 All data saved in browser IndexedDB (survives page refresh, no size limit)

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `fahad-portfolio`)
2. Upload these 3 files: `index.html`, `style.css`, `app.js`
3. Go to **Settings → Pages → Source → main branch → / (root)**
4. Your portfolio will be live at: `https://yourusername.github.io/fahad-portfolio`

## Storage

All uploaded images and documents are saved in **IndexedDB** (browser storage with no practical size limit). This means:
- Profile photo, cert images, resume, CV all persist after refresh
- No file-too-large errors

> **Note:** IndexedDB data is stored in the browser. If a recruiter visits your live URL, they see only the default content — not your uploaded files. To show uploaded content to everyone, host images externally (e.g. Cloudinary free tier) and paste the URL.
