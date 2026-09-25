# KnowledgeGainzz: Personal Training Website

The business site for **KnowledgeGainzz**, personal training with Leo (NASM CPT) at PureGym Giltbrook, Nottingham.

It's plain HTML, CSS and vanilla JavaScript with no frameworks and no build step. Open `index.html` in a browser to view it.

## Files

| File | What it does |
|------|--------------|
| `index.html` | Home page: hero + CTA, about, how it works, coaching options, location, socials |
| `enquire.html` | 6-step enquiry form: details → PAR-Q → experience & activity → goals → nutrition → review & consent |
| `privacy.html` | Privacy notice (needed because the form collects health data) |
| `css/styles.css` | All styles. Brand colours are at the top in `:root` |
| `js/config.js` | **The only file you need to edit:** your email, socials and EmailJS keys |
| `js/main.js` | Mobile menu, social links, scroll animations |
| `js/enquiry.js` | Form steps, validation, PAR-Q flagging, draft saving, sending emails |
| `email-templates/leo-notification.html` | Email you receive for each enquiry |
| `email-templates/client-autoreply.html` | Automatic email the client receives with their checklist |
| `assets/favicon.svg` | Browser tab icon |

## How the automated enquiry system works

1. A client clicks **Start your enquiry** and completes the form. Their answers save on their device as they go, so nothing is lost if they close the tab.
2. If they answer "yes" to any PAR-Q question, the form asks for details and flags the enquiry.
3. On submit, two emails are sent automatically:
   - **To you:** all their answers, with the PAR-Q status in the subject line. Press Reply and it goes straight to the client.
   - **To the client:** a copy of their answers and a **personalised checklist**, e.g. log 3 days of food, book the consultation, bring medication. It also adds items like "get GP clearance" if the PAR-Q is flagged, or "parental consent" for under-18s.
4. The same checklist appears on screen after they submit.

## Setup (about 15 minutes)

### 1. Edit `js/config.js`
Add your real business email and your Instagram and TikTok URLs.

### 2. Set up EmailJS (free: 200 emails/month)
1. Sign up at [emailjs.com](https://www.emailjs.com/).
2. **Email Services → Add New Service →** connect the Gmail/Outlook account you want to send from. Copy the **Service ID**.
3. **Email Templates → Create New Template**, twice:
   - **Leo notification:** follow the instructions in the comment at the top of `email-templates/leo-notification.html`. Copy its **Template ID**.
   - **Client auto-reply:** follow the comment in `email-templates/client-autoreply.html`. Set **To Email** to `{{client_email}}`. Copy its **Template ID**.
4. **Account → General:** copy your **Public Key**.
5. Paste all four values into the `emailjs` section of `js/config.js`.
6. **Account → Security:** add your website's domain to the allowed origins so nobody else can use your keys.

Until EmailJS is set up, the form still works. It opens the client's email app with their answers addressed to you, and shows the checklist on screen.

### 3. Put it online (free)

This repo already has `.github/workflows/deploy-pages.yml`, which auto-publishes the
site to GitHub Pages on every push. It just needs switching on once:

1. On GitHub: **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. That's it. The next push (or re-running the "Deploy site to GitHub Pages" action
   under the **Actions** tab) publishes the site to:
   `https://<your-github-username>.github.io/<repo-name>/`

This is the link to put in your Instagram/TikTok bio and to generate a QR code for.

Alternatives:
- **Netlify:** drag the project folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
- Optional: buy a domain such as `knowledgegainzz.co.uk` (about £10/year) and connect it
  to whichever host you use, for a fully branded link.

## Social media automation

A static site can't send Instagram or TikTok DMs itself, but you can connect your socials to the enquiry form:

- **Instagram:** use [ManyChat](https://manychat.com/) (free plan, Meta-approved). Set a keyword trigger so that when someone comments or DMs **"COACH"**, they automatically get a DM with your enquiry link, e.g. `https://yoursite.com/enquire.html`. Mention the keyword at the end of your Reels.
- **TikTok:** put the enquiry link in your bio (TikTok business accounts allow a bio link), and set up TikTok's built-in **auto-message / keyword replies** in Business Suite to send the link to anyone who DMs you.
- **Link in bio:** point your Instagram and TikTok bio links straight at `enquire.html`.
- The form asks each client how they'd like to be contacted (email, Instagram DM, TikTok DM or phone) and for their username, so you know where to reply.

## Before going live

- [ ] Real email and social URLs in `js/config.js`
- [ ] EmailJS keys added, and a test enquiry sent to yourself
- [ ] Check `privacy.html` matches how you handle data. It's a starting point, not legal advice.
- [ ] Consider registering with the ICO (small fee), since you're storing clients' health data
- [ ] Confirm PureGym's rules for self-employed PTs at Giltbrook, and make sure your insurance is in place
- [ ] Optional: replace the "L" placeholder in the About section with a photo of you
