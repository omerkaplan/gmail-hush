// Split inbox definitions. Each split is a list of Gmail search terms that are OR'ed together.
// "Inbox" automatically shows everything in the inbox that doesn't match any split.
// "color" is the tab's underline color.
// Search operator reference: https://support.google.com/mail/answer/7190
// Inbox zero streak carried over from before Hush (Superhuman): `weeks` consecutive weeks
// ending with the week that contains `through` (YYYY-MM-DD).
var HUSH_STREAK_SEED = { weeks: 89, through: "2026-10-12" };

var HUSH_INBOX_COLOR = "#8f80ff";
var HUSH_ALL_COLOR = "#a3a6ad";
var HUSH_SPLITS = [
  {
    id: "docs",
    label: "Docs",
    color: "#4ea8ff",
    terms: [
      "from:drive-shared-noreply@google.com",
      "from:drive-shared-dataitems-noreply@google.com",
      "from:comments-noreply@docs.google.com",
      "from:docs.google.com",
      "from:sheets.google.com",
      "from:slides.google.com",
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    color: "#f5a524",
    terms: [
      "filename:ics",
      "from:calendar-notification@google.com",
      'subject:"Invitation:"',
      'subject:"Updated invitation"',
      'subject:"Accepted:"',
      'subject:"Declined:"',
      'subject:"Tentatively accepted:"',
    ],
  },
  {
    id: "alerts",
    label: "Alerts",
    color: "#ff6b6b",
    terms: ["from:honeybadger.io"],
  },
];
