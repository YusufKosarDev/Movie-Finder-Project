# MovieFinder Project

A modern, portfolio-ready Movie Search application built with vanilla HTML, CSS, and JavaScript. It uses a public movie database API, supports cloud-synced favorites, dark/light mode, charts and simple gamification for a polished demo-ready experience.


## 📝 What Does It Do?

MovieFinder gives users a clean interface to search movies and interact with results:

Search movies by title (powered by OMDb API)

Display simple result list with poster, title, year and type

Open a detail modal (full plot, IMDb rating, director, actors)

Add / remove favorites (localStorage + optional cloud sync via Firebase)

View favorites analytics (Chart.js doughnut chart) and export favorites as JSON

Dark / Light theme toggle and a small gamification badge based on favorite count

Pagination / "Load more" for multi-page results


## ⚙️ How Does It Work?

Built with core web tech and a few libraries:

HTML Structure – semantic layout, accessible controls, result list, and modals.

CSS Styling – responsive dark/light themes, modal behavior, and chart modal fixes.

Vanilla JavaScript – DOM selection, event handling, debounce search, pagination, client cache (sessionStorage), and favorites management.

API calls – searches use ?s= and details use ?i= endpoints of the OMDb API.

Cloud favorites (optional) – anonymous Firebase auth + Firestore for syncing favorites across devices (configure firebaseConfig in index.html). Uses Firebase.

Charts – favorites analytics rendered with Chart.js.

Deploy – put code on GitHub and deploy with Vercel or Netlify.


## 🎓 What Have I Learned?

By building MovieFinder I improved my:

API integration skills (requesting, caching, error handling)

UX & accessibility: modals, aria attributes, keyboard handling

State management in vanilla JS (search state, pagination, favorites)

Client-side persistence (localStorage + sessionStorage) and simple cloud sync (Firestore)

Visual data display using Chart.js and building small gamification UX


### 🚀 Live Demo :
