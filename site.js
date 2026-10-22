/* ------------------------------------------------------------------
   Site settings. This is the only file you need to edit by hand
   (apart from data/videos.js titles). Everything else reads from here.
------------------------------------------------------------------- */
window.SITE = {
  // Shown in the header on every page and large on the home page.
  name: "Jivanjot",

  // Your portrait for the blurred home background. It is blurred on screen,
  // so a 1280px-wide JPEG saved at low quality (under ~100 KB) is plenty.
  heroPhoto: "assets/me.jpg",

  // Contact links. Replace both before you publish.
  // WhatsApp format: https://wa.me/<country code + number, digits only>
  whatsapp: "https://wa.me/91XXXXXXXXXX",
  whatsappMessage: "Hi! I saw your edits and want to talk about a project.",
  instagram: "https://www.instagram.com/yourhandle/",

  // Where your videos and posters live. Leave "" while they sit in this folder.
  // When you upload them to a CDN / storage bucket, put its address here,
  // e.g. "https://media.yourdomain.com/"  (keep the trailing slash).
  mediaBase: "",

  // The three categories. The caption is what visitors read on the home page
  // and above each grid on the Edits page. Change the wording any time.
  categories: [
    { id: "short",  label: "Short form",        caption: "Sixty seconds. Zero wasted frames." },
    { id: "long",   label: "Long form",         caption: "The slow burn that earns the whole sitting" },
    { id: "colour", label: "Colour correction", caption: "Same footage. Completely different mood." }
  ]
};
