import type { ReasonCode, ResultNote } from '@cekkutip/shared'

/**
 * English copy deck. This file defines the shape (`Dict`); id.ts must match it.
 * Verdict names are never translated. Their explanations are.
 * Placeholders in reason texts: {source} {n} {type}.
 */
export const en = {
  meta: {
    siteName: 'CekKutip',
    description:
      'Paste your references. CekKutip looks each one up in Crossref, OpenAlex, and Garuda and tells you if it exists and if the details match.',
    titles: {
      home: 'Check a reference list',
      how: 'How it works',
      evaluation: 'Evaluation',
      format: 'Fix reference formatting',
      about: 'About',
      extension: 'Browser extension',
      privacy: 'Privacy',
      notFound: 'Page not found',
    },
  },
  nav: {
    label: 'Main',
    check: 'Check',
    how: 'How it works',
    evaluation: 'Evaluation',
    format: 'Format',
    about: 'About',
    extension: 'Extension',
    language: 'Language',
    skip: 'Skip to content',
    switchTo: { en: 'Switch to English', id: 'Switch to Bahasa Indonesia' },
    theme: { toDark: 'Switch to dark mode', toLight: 'Switch to light mode' },
  },
  footer: {
    privacy: 'Privacy',
    statement: 'Verdicts are prompts for review, not findings of misconduct.',
    builtBy: 'Built by {team}',
  },
  verdict: {
    verified: 'Verified',
    mismatch: 'Mismatch',
    suspect: 'Suspect',
    out_of_index: 'Out-of-index',
    check_failed: 'Could not check',
  },
  verdictDefinitions: {
    verified: 'We found the work. Title, authors, and year agree.',
    mismatch: 'We found the work, but some details you cited do not match.',
    suspect: 'We could not find it, though it is cited like something findable. Check by hand.',
    out_of_index: 'Sources like this are often not indexed, so we cannot tell. Check by hand.',
  },
  reasons: {
    verified_all_match: 'Found in {source}. Title, authors, and year agree.',
    mismatch_authors: 'This work exists, but the authors do not match the record.',
    mismatch_year: 'This work exists, but the year differs by {n} years.',
    mismatch_venue: 'This work exists, but it was published in a different journal.',
    mismatch_doi_other_work: 'This DOI leads to a different work.',
    suspect_doi_not_found: 'This DOI is not registered. Check the source by hand.',
    suspect_no_record_journal:
      'Not found, although it is cited like a journal article. Check the source by hand.',
    out_of_index_type:
      'This looks like a {type}. Crossref and OpenAlex often do not hold these. Check it by hand.',
    out_of_index_insufficient_data: 'Too little detail to search. Add the title and authors.',
    out_of_index_other_registry: 'This DOI belongs to a registry we do not search yet.',
    check_failed_network: 'The lookup service did not respond. This is not a verdict. Try again.',
  } satisfies Record<ReasonCode, string>,
  /** Notes next to a result. They add to the verdict and never change it. {others} is "no. 5" or "no. 5 and 13". */
  notes: {
    year_differs:
      'The year is one off: you wrote {cited}, the record has {found}. A record may date the online release, and a reference the printed issue. Check the year on the journal page.',
    authors_partial:
      'The record has {found} authors, and you wrote {cited}, with no "et al." Check that the author list is complete.',
    same_record:
      'This reference leads to the same record as {others}. Check whether it is listed twice.',
  } satisfies Record<ResultNote['code'], string>,
  home: {
    h1: 'Check a reference list before you submit it.',
    intro:
      'Paste your references. CekKutip looks each one up and tells you if it exists and if the details match.',
    inputLabel: 'References',
    found: (n: number) => `${n} found`,
    placeholderHint: 'One reference per paragraph, or numbered.',
    noAi: 'Do not send my text to an AI service (less accurate)',
    notice:
      'Your text goes to Google Gemini to read the fields, then to Crossref and OpenAlex for lookup. A title that neither finds is also sent to Garuda, the Indonesian journal index. We do not store it.',
    noticeLink: 'Privacy details',
    check: 'Check references',
    example: 'Try an example',
    clear: 'Clear',
    resultsTitle: 'Results',
    emptyHint: 'Paste your references and press Check references. Results appear here.',
    emptyLegend: 'What the four verdicts mean',
    statement: 'Verdicts are prompts for review, not findings of misconduct.',
    howTitle: 'How a check works',
    howMore: 'See a full example',
    steps: [
      { name: 'Parse', text: 'A language model reads the fields. It never decides the result.' },
      { name: 'Retrieve', text: 'We look the work up in Crossref, then OpenAlex, then Garuda (Indonesian journals).' },
      { name: 'Match', text: 'We compare title, authors, year, and venue.' },
      { name: 'Decide', text: 'Fixed rules give one of four verdicts.' },
    ],
    extTitle: 'Check from any web page',
    extText: 'A free browser extension opens CekKutip in a side panel next to the page.',
    extLink: 'Get the browser extension',
    notTitle: 'What CekKutip does not do',
    notItems: [
      'It does not check whether a source supports your claim.',
      'It does not detect plagiarism.',
      'It cannot see many books, theses, and reports. It says so instead of guessing.',
      'A verdict is not proof of misconduct.',
    ],
  },
  how: {
    h1: 'How a check works',
    lede: 'Four steps. Only the first uses a language model, and it never decides the result.',
    diagramTitle: 'The four steps',
    diagramDesc:
      'Four steps in a row: Parse, Retrieve, Match, Decide. Only Parse uses a language model. The other three are fixed code.',
    diagramSteps: [
      { name: 'Parse', note: 'Reads the fields', tag: 'Language model' },
      { name: 'Retrieve', note: 'Crossref, OpenAlex, Garuda', tag: 'No model' },
      { name: 'Match', note: 'Compares four fields', tag: 'No model' },
      { name: 'Decide', note: 'Fixed rules, one verdict', tag: 'No model' },
    ],
    diagramNote:
      'The model only turns text into fields. It never looks anything up or picks the verdict.',
    exampleTitle: 'One reference, step by step',
    exampleIntro:
      'A real reference with two details changed, the year and the journal, to show a Mismatch.',
    exampleCitedLabel: 'The reference as pasted',
    exampleSteps: [
      {
        name: 'Parse',
        text: 'The model returns the fields: two authors, the year 2021, a title, a journal.',
      },
      {
        name: 'Retrieve',
        text: 'There is no DOI, so we search Crossref by title, first author, and year. A record with the same title comes back.',
      },
      {
        name: 'Match',
        text: 'Title and authors agree. The year is two years off and the journal differs.',
      },
      {
        name: 'Decide',
        text: 'The title matches but the year and journal do not. The rule gives Mismatch.',
      },
    ],
    tableCaption: 'The reference compared with the record',
    colField: 'Field',
    colCited: 'As cited',
    colFound: 'Record found (Crossref)',
    colStatus: 'Status',
    fields: { title: 'Title', authors: 'Authors', year: 'Year', venue: 'Venue', doi: 'DOI' },
    states: {
      agree: 'agree',
      differs: 'differs',
      not_cited: 'not cited',
      not_found: 'not found',
    },
    yearDiffers: 'differs by {n}',
    exampleResult: 'Result',
    exampleResultText: 'This work exists, but the year and the journal differ from the record.',
    rulesTitle: 'The rules, in order',
    rulesIntro:
      'The first rule that applies decides. The cut-offs for a matching title or author are tuned on practice data only, then frozen before the final test.',
    rulesColIf: 'If',
    rulesColResult: 'Result',
    rules: [
      { if: 'A lookup service did not respond after retries.', result: 'check_failed' },
      { if: 'The DOI is not registered anywhere.', result: 'suspect' },
      { if: 'The DOI leads to a record with a very different title.', result: 'mismatch' },
      { if: 'A record matches on title, authors, year, and journal.', result: 'verified' },
      {
        if: 'A record matches on title, but authors, year, or journal differ.',
        result: 'mismatch',
      },
      {
        if: 'Cited like a journal article, and no record is close enough.',
        result: 'suspect',
      },
      {
        if: 'A book, chapter, thesis, report, web page, or other source, and no record is close enough.',
        result: 'out_of_index',
      },
      { if: 'Too little detail to search.', result: 'out_of_index' },
      { if: 'The DOI belongs to a registry we do not search yet.', result: 'out_of_index' },
    ],
    checkFailedNote:
      'Could not check is a status, not a verdict. It never counts against a reference.',
    limitsTitle: 'Limits',
    limits: [
      'Crossref, OpenAlex, and Garuda are incomplete. A real source can be missing from all three. That is why Out-of-index exists.',
      'Verified means the work exists and the details agree, not that your source supports your claim.',
      'The model can misread an unusual format. If it fails, the no-AI reader takes over for that reference.',
    ],
  },
  evaluation: {
    h1: 'Evaluation',
    lede: 'We test CekKutip on a labelled set of references and with students.',
    loading: 'Loading results',
    emptyTitle: 'No results yet',
    empty: 'Results will be published after data lock on 9 December 2026.',
    emptyNote: 'Until then this page shows no numbers, because there is nothing measured to show.',
    technicalTitle: 'Technical evaluation',
    technical:
      'Two people label a set of references by hand. CekKutip and three simpler baselines run on references held out until the end. We also switch parts of CekKutip off, one at a time, to see what each adds.',
    userTitle: 'User study',
    user: 'A short study with students: does the tool help them find problems in a reference list, and how do they judge its explanations?',
    results: {
      loading: 'Loading results',
      factsTitle: 'How these results were made',
      version: 'CekKutip version',
      commit: 'Commit',
      uncommitted: 'with uncommitted changes',
      model: 'Language model',
      noModel: 'none used',
      date: 'Date',
      cutoffs: 'Cut-offs',
      cutoffsSource: 'chosen on the development set only',
      intervals: 'Intervals',
      intervalsText: (resamples: number, seed: number) =>
        `95% confidence intervals by percentile bootstrap: ${resamples} resamples, fixed seed ${seed}.`,
      dataset: 'Data',
      datasetText: (n: number) => `${n} references, labelled by two people.`,
      splits: {
        dev: 'Development set (used to choose the cut-offs)',
        test: 'Test set (run once, after the cut-offs were frozen)',
        all: 'All references',
      } as Record<string, string>,
      mainTitle: 'Main comparison',
      timeTitle: 'Time and cost',
      timeCaption: (split: string) => `Time and cost, ${split}`,
      mainCaption: (split: string) => `Main comparison, ${split}`,
      run: 'System',
      n: 'References',
      macroF1: 'Macro-F1 (95% interval)',
      falseAccusation: 'False accusation rate (95% interval)',
      falseAccusationOf: (n: number) => `of ${n} real or unindexed`,
      abstain: 'Abstain rate (95% interval)',
      latency: 'Median time (ms)',
      cost: 'Cost per 1,000 (USD)',
      couldNotCheck: 'Could not check',
      latencyNote:
        'Time is meaningful only for a run that made its own requests. A run that replays saved lookups shows much lower times. Token counts and cost are replayed too, and stay valid.',
      f1Title: 'F1 for each verdict',
      f1Caption: (split: string) => `F1 for each verdict, ${split}`,
      binaryTitle: 'Verified against not verified',
      binaryText:
        'The baselines B2 and B3 only answer Verified or Suspect, so every system is also compared on this single question.',
      binaryCaption: (split: string) => `Verified against not verified, ${split}`,
      precision: 'Precision',
      recall: 'Recall',
      f1: 'F1',
      accuracy: 'Accuracy',
      ablationTitle: 'What each part adds',
      ablationText:
        'Each row switches one part off. The change is measured against the full pipeline on the same references.',
      ablationCaption: (split: string) => `Ablations, ${split}`,
      change: 'Change',
      syntheticTitle: 'With and without altered references',
      syntheticText:
        'Some references were altered on purpose for testing. Here is the same comparison with and without them.',
      syntheticCaption: (split: string) => `With and without altered references, ${split}`,
      altered: 'Altered references',
      withAll: 'All references',
      withoutAltered: 'Without altered',
      kappaTitle: 'Agreement between the two people who labelled the references',
      kappaText: (kappa: string, n: number, observed: string, expected: string) =>
        `Cohen kappa ${kappa} on ${n} references (agreement ${observed}, expected by chance ${expected}).`,
      kappaSkipped: (n: number) => `${n} references without two labels were left out.`,
      kappaCaption: 'Labeler 1 (rows) against labeler 2 (columns)',
      labeler1: 'Labeler 1',
      notAvailable: 'n/a',
      systems: {
        cekkutip: 'CekKutip, full pipeline',
        b1_llm_only: 'B1: language model only',
        b2_crossref_top1: 'B2: top Crossref hit',
        b3_doi_check: 'B3: DOI check',
      } as Record<string, string>,
      ablations: {
        a1: 'A1: no abstain',
        a2: 'A2: no OpenAlex',
        a3: 'A3: pattern reader instead of the model',
        a4: 'A4: no author check',
        a5: 'A5: no Garuda',
      } as Record<string, string>,
    },
    metricsTitle: 'What we will report',
    metricsTitleDone: 'What we report',
    metrics: [
      'Macro-F1 across the four verdicts, with 95% confidence intervals.',
      'Precision, recall, and F1 for each verdict.',
      'False accusation rate: how often a real or unindexed source is marked Suspect or Mismatch.',
      'Abstain rate: how often the answer is Out-of-index.',
      'Median time per reference, and cost per 1,000 references.',
      'Agreement between the two people who labelled the references (Cohen kappa).',
      'Results with and without references altered on purpose for testing.',
    ],
  },
  about: {
    h1: 'About CekKutip',
    lede: 'A reference checker built by students, for students.',
    storyTitle: 'Why we built it',
    story:
      'AI assistants can write references that look complete but point to nothing, or carry the wrong author, year, or journal. Most checkers return only a match or a score. CekKutip adds Mismatch, for real works cited wrongly, and Out-of-index, for sources it cannot see.',
    teamTitle: 'Team',
    supervisorTitle: 'Supervisor',
    universityTitle: 'University',
    competitionTitle: 'Competition',
    competition:
      'Built for the Global Youth Invention and Innovation Fair (GYIIF) 2027, hosted by IPB University. Engineering and Technology, online track.',
    limitsTitle: 'Limits',
    limits: 'CekKutip cannot see everything.',
    limitsLink: 'See the limits',
    contactTitle: 'Contact and code',
    contactEmail: 'Email',
    github: 'Source code on GitHub',
    demo: 'Live demo',
    servicesTitle: 'Services we use',
    services: [
      {
        name: 'Crossref',
        url: 'https://www.crossref.org/',
        text: 'Metadata for scholarly works, by DOI or title.',
      },
      {
        name: 'OpenAlex',
        url: 'https://openalex.org/',
        text: 'A second index, used when Crossref has no close record.',
      },
      {
        name: 'Garuda',
        url: 'https://garuda.kemdiktisaintek.go.id/',
        text: 'The national index of Indonesian journals. Asked last, and only for a journal article that Crossref and OpenAlex do not hold. Only the title is sent.',
      },
      {
        name: 'Google Gemini',
        url: 'https://ai.google.dev/',
        text: 'Reads each reference into fields. It never decides a verdict.',
      },
    ],
  },
  privacy: {
    h1: 'Privacy',
    lede: 'What happens to the text you paste.',
    items: [
      'By default, your reference text is sent to Google Gemini, only to read the fields: authors, year, title. Choose "Do not send my text to an AI service" to avoid this. Results are then less accurate.',
      'Google states that content sent through its free tier can be used to improve its products and read by human reviewers.',
      'The title, authors, and DOI read from your references go to Crossref and OpenAlex, and to DataCite when needed (for a DOI, or for the DOI made from an arXiv ID), to look the work up. A title that neither of the first two finds close is also sent, alone, to Garuda, the national index of Indonesian journals.',
      'If you add your own Gemini key, it stays in your browser. It is sent with each check, used only to ask Google to read your references, and never stored or logged. The browser extension shares it with the site on your device.',
      'A .txt or .bib file you choose or drop on the page is read in your browser, like pasted text. Nothing is sent until you choose Check references.',
      'The Format page rewrites your references in your browser by fixed rules. No language model reads them, and nothing you paste there is sent to us or to any service.',
      'Our server does not store your text. Our logs hold only a request id, the number of references, timings, and error codes.',
      'We follow the principles of Indonesian Law No. 27 of 2022 on Personal Data Protection: collect little, use it for one purpose, keep nothing we do not need. This describes our approach, not legal compliance.',
      'Do not paste sensitive or personal information. A reference list does not need any.',
    ],
    googleTerms: "Read Google's terms for the Gemini API",
  },
  results: {
    progress: (n: number, total: number) => `${n} of ${total} checked`,
    checking: 'Checking',
    filterLabel: 'Show results',
    all: 'All',
    showDetails: (n: number) => `Show details for reference ${n}`,
    hideDetails: (n: number) => `Hide details for reference ${n}`,
    exportCsv: 'Export CSV',
    copyReport: 'Copy report',
    copied: 'Copied',
    copyFailed: 'Could not copy. Select the text and copy it by hand.',
    noneInFilter: 'No references with this result.',
    finished: (total: number) => `Check finished. ${total} references checked.`,
    barLabel: 'Results by verdict',
    notesLabel: 'Notes',
    /** "no. 5", "no. 5 and 13", "no. 1, 3 and 7": the numbers shown beside the references. */
    numbers: (nums: number[]) =>
      nums.length === 1
        ? `no. ${nums[0]}`
        : `no. ${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`,
    printFiltered: 'Showing only {verdict} results: {shown} of {total}.',
    aiIssue: {
      rejectedOwn:
        'Google did not accept your Gemini key, so the no-AI reader was used instead. Check the key.',
      quotaOwn:
        'Your Gemini key reached its usage limit, so the no-AI reader read some references.',
      rejectedShared:
        'The shared AI reader is not available right now, so the no-AI reader was used. You can add your own free Gemini key.',
      quotaShared:
        'The shared AI reader reached its daily limit, so the no-AI reader read some references. Add your own free Gemini key to keep using AI.',
    },
  },
  evidence: {
    caption: (n: number) => `Reference ${n} compared with the record`,
    asCited: 'As cited',
    recordFound: 'Record found ({source})',
    recordNone: 'Record found',
    status: 'Status',
    field: 'Field',
    noRecord: 'No record is shown, because none was close enough.',
    openRecord: 'Open record',
    scholar: 'Search on Google Scholar',
    opensNewTab: 'opens in a new tab',
    nextStep: 'Next step',
    next: {
      verified: 'Nothing to fix. Still read the source before you rely on it.',
      mismatch: 'Open the record and correct the details you cited.',
      suspect: 'Search for it by hand. If you cannot find it, do not keep it in your list.',
      out_of_index: 'Check by hand: search the title, or ask your library or campus repository.',
      check_failed: 'Check this reference again in a moment.',
    },
    details: 'Details',
    titleScore: 'Title similarity',
    authorsScore: 'Cited authors found',
    yearDiff: 'Year difference',
    venueScore: 'Venue similarity',
    notCompared: 'not compared',
    readBy: 'Fields read by',
    readers: { llm: 'language model', regex: 'pattern reader, no AI' },
    reasonCodes: 'Reason codes',
    sourceType: 'Read as',
  },
  corrected: {
    title: 'Corrected reference (APA 7)',
    note: 'Written from the record by fixed rules, not by a language model. Check it against the source, then italicize the journal name and volume and use sentence case for the article title.',
    copy: 'Copy reference',
    copied: 'Copied',
    copyFailed: 'Could not copy. Select the text and copy it by hand.',
  },
  sources: { crossref: 'Crossref', openalex: 'OpenAlex', datacite: 'DataCite', garuda: 'Garuda' },
  types: {
    journal_article: 'journal article',
    book: 'book',
    book_chapter: 'book chapter',
    conference_paper: 'conference paper',
    thesis: 'thesis',
    report: 'report',
    web_page: 'web page',
    other: 'source of another kind',
  },
  errors: {
    title: 'The check did not finish',
    generic: 'Something went wrong on our side. Your text was not stored. Try again in a moment.',
    network:
      'We could not reach the server. Your text was not stored. Check your connection and try again.',
    incomplete:
      'The check stopped before it finished. The results shown are incomplete. Try again.',
    rate_limited: 'You have reached the limit of checks for now. Wait a few minutes and try again.',
    too_many_references:
      'You can check up to {max} references at a time. Split your list and check it in parts.',
    reference_too_long:
      'Reference {n} is longer than {max} characters. Shorten it, or check that it is one reference.',
    no_references: 'Paste at least one reference to check.',
    invalid_api_key:
      'The Gemini key does not look right. Open "Use your own Gemini API key" to check it or remove it.',
    tryAgain: 'Try again',
  },
  workbench: {
    aiUnavailable:
      'The AI reader is not set up on this server. A no-AI reader on our server is used instead. We do not store your text.',
    shortcut: 'Ctrl+Enter',
    checkingButton: 'Checking',
  },
  apiKey: {
    summary: 'Use your own Gemini API key (optional)',
    intro:
      "The AI reader uses this site's shared Gemini key, which has a daily limit. Add your own free key to use your own limit.",
    label: 'Gemini API key',
    show: 'Show key',
    save: 'Save key',
    remove: 'Remove key',
    getKey: 'Get a free key from Google AI Studio',
    statusNone: 'No key saved. The shared reader is used.',
    statusSet: 'Using your key: {masked}',
    saved: 'Key saved in this browser.',
    removed: 'Key removed. The shared reader is used.',
    invalid: 'That does not look like a Gemini API key. Check it and try again.',
    privacy:
      'The key stays in your browser. It is sent with each check, used only to ask Google to read your references, and never stored or logged.',
    linked:
      'The CekKutip browser extension is connected. A key saved here also appears in the extension.',
  },
  extension: {
    openSite: 'Open the CekKutip website',
    keyNote: 'The CekKutip site uses this key too, once opened in this browser.',
    menuTitle: 'Check selection with CekKutip',
    autoFillLabel: 'Fill the box when I select text on a page',
    autoFillHint:
      'Your browser will ask permission to read text you select on websites. Nothing is sent until you press Check references.',
    autoFillOn: 'On. Select a sentence on a page and it appears in the box.',
    autoFillDenied: 'Permission was not granted, so this stays off.',
    liveOffer: 'Selected on the page. Your own text is in the box, so it was kept:',
    liveAdd: 'Add to the box',
    liveReplace: 'Replace the box',
    liveIgnore: 'Ignore',
  },
  extensionPage: {
    h1: 'Browser extension',
    lede: 'Check references from any web page, in a side panel next to it. It is the same check as this site.',
    getTitle: 'Get the extension',
    download: 'Download the extension (.zip)',
    getNote:
      'Free, no account. Works in Chrome and Edge 127 or later. It is not in a store yet, so you install it from this file.',
    installTitle: 'Install it',
    installSteps: [
      {
        name: 'Download and unzip',
        text: 'Unzip the file into a folder you will keep. The browser reads the extension from that folder, so do not delete it.',
      },
      {
        name: 'Open the extensions page',
        text: 'Go to `chrome://extensions` (in Edge, `edge://extensions`) and turn on Developer mode.',
      },
      {
        name: 'Load the folder',
        text: 'Press Load unpacked and choose the folder that has `manifest.json` directly inside it.',
      },
      {
        name: 'Pin it',
        text: 'Click the puzzle-piece icon next to the address bar, then the pin beside CekKutip.',
      },
    ],
    installNote: 'Chrome may warn about an extension in developer mode. You can dismiss it.',
    useTitle: 'Use it',
    useItems: [
      'Click the CekKutip icon. A side panel opens and stays open while you browse. Paste your references and press Check references.',
      'Or select text on a page, right-click, and choose "{menu}".',
      'To fill the box by itself, turn on "{autofill}" at the top of the panel. Your own text is never replaced.',
      'A Gemini key you add here or on the site is shared between them, in the same browser.',
    ],
    accessTitle: 'What it can access',
    accessItems: [
      'This site only, until you turn on "{autofill}". It cannot read other pages, tabs, history, or cookies.',
      'With that setting on, it reads only the text you select, never form fields, and puts it in the box. Turning it off removes the permission.',
      'Your Gemini key stays on your device. The references you check go to our server, which does not store or log them.',
    ],
    privacyLink: 'Read the privacy details',
    sourceLink: 'Read the extension source code on GitHub',
    updateTitle: 'Update or remove',
    updateItems: [
      'To update, download the new file, extract it over the same folder, and press the reload icon on the CekKutip card.',
      'To remove, press Remove on the CekKutip card, then delete the folder.',
    ],
  },
  upload: {
    button: 'Upload .txt or .bib',
    hint: 'Read in your browser, not uploaded. Up to {max} KB. You can also drop files onto this page.',
    dropTitle: 'Drop to add to your list',
    dropHint: '.txt or .bib files, read in your browser',
    failed: (name: string, reason: string) => `${name}: ${reason}`,
    ignored: (n: number, max: number) =>
      `Only the first ${max} files were read. ${n} more ${n === 1 ? 'file was' : 'files were'} left out.`,
    added: (n: number, name: string) =>
      `Added ${n} ${n === 1 ? 'reference' : 'references'} from ${name}.`,
    skipped: (n: number) =>
      `${n} ${n === 1 ? 'entry' : 'entries'} without a title ${n === 1 ? 'was' : 'were'} left out.`,
    errors: {
      too_large: 'That file is larger than {max} KB. Split it and upload it in parts.',
      unsupported: 'Only .txt and .bib files are supported.',
      empty: 'No references were found in that file.',
      unreadable: 'That file could not be read as text.',
    },
  },
  format: {
    h1: 'Fix reference formatting',
    lede: 'Paste your references, choose a style, and each journal article is written the way that style asks. It runs in your browser: nothing is sent.',
    inputLabel: 'References',
    styleLegend: 'Style',
    styles: { apa: 'APA 7', ieee: 'IEEE', harvard: 'Harvard' },
    styleNote: {
      apa: 'APA 7th edition, as the APA Style site gives it. The journal and the volume are in italics.',
      ieee: 'IEEE, numbered in the order you give. Initials come before the family name.',
      harvard:
        'Harvard in the Cite Them Right pattern, as university guides such as the Open University guide give it. Harvard differs from one university to the next: check your own guide.',
    },
    sortLabel: 'Sort by first author (A to Z)',
    sortHint: 'APA and Harvard lists are in alphabetical order.',
    ieeeOrder: 'IEEE lists are numbered in the order you gave them.',
    sentenceLabel: 'Put titles in sentence case',
    sentenceHint:
      'Capitals only for the first word and for acronyms. Names of people and places are lowered too, so check them afterwards.',
    example: 'Try an example',
    clear: 'Clear',
    privacy:
      'Your references are rewritten in this browser by fixed rules. No language model reads them and nothing is sent to our server.',
    resultsTitle: 'Result',
    empty: 'Paste references on the left. The rewritten list appears here.',
    summary: (n: number, changed: number, same: number, kept: number) =>
      `${n} ${n === 1 ? 'reference' : 'references'}: ${changed} rewritten, ${same} already ${same === 1 ? 'matches' : 'match'}, ${kept} kept as written.`,
    copyAll: 'Copy all, with italics',
    copyAllPlain: 'Copy all, plain text',
    copyOne: 'Copy',
    copyOneLabel: (n: number) => `Copy reference ${n}`,
    copied: 'Copied',
    copyFailed: 'Could not copy. Select the text and copy it by hand.',
    reference: (n: number) => `Reference ${n}`,
    asWritten: 'As written',
    inStyle: (style: string) => `In ${style}`,
    status: {
      changed: 'Rewritten',
      same: (style: string) => `Already matches ${style}`,
      not_rewritten: 'Kept as written',
    },
    whatChanged: 'What changed',
    fields: {
      authors: 'Authors',
      year: 'Year',
      title: 'Title',
      source: 'Journal and pages',
      doi: 'DOI or link',
    },
    nothing: 'nothing',
    noPart: 'not a separate part',
    arrow: 'becomes',
    reasons: {
      not_journal_article:
        'This is not a journal article that can be read (it may be a book, a thesis, a web page, or a conference paper), so it is kept as written. Only the list number and the form of the DOI were tidied. Check it against your style guide.',
      unreadable:
        'The authors, the year, the title, or the journal could not be read, so it is kept as written. Check it by hand.',
    },
    notesTitle: 'Check by hand',
    notes: {
      names_uncertain:
        'The order of some names was guessed: the last word is taken as the family name. Check the names.',
      et_al_kept:
        'The text says "et al." and the other authors are not in it. Add them from the source if your style lists every author.',
      authors_shortened: (style: string): string =>
        style === 'IEEE'
          ? 'IEEE writes the first author and "et al." when there are more than six authors, so the other names were left out.'
          : style === 'APA 7'
            ? 'APA 7 writes the first 19 authors, then "...", then the last author, when there are 21 or more.'
            : 'Some authors were left out.',
      article_number_assumed:
        'A single page number of five digits or more, or one that starts with a letter, was read as an article number. Check it.',
      title_case: (style: string) =>
        `The title has a capital on almost every word. ${style} asks for capitals only on the first word, names, and acronyms. It was left as written, because names cannot be told from other words. Turn on "Put titles in sentence case" to change it, then check the names.`,
      sentence_case_applied:
        'The title was put into sentence case. Names of people and places were lowered too: write them with capitals again where needed.',
      ieee_journal_abbreviation:
        'IEEE abbreviates journal names (for example "Sci. Rep."). The name is written in full here. Abbreviate it with the IEEE list if your journal asks.',
    },
    bib: {
      title: 'BibTeX',
      fileTitle: (name: string, n: number) => `${name}: ${n} ${n === 1 ? 'entry' : 'entries'}`,
      summary: (fixed: number, flagged: number) =>
        `${fixed} ${fixed === 1 ? 'fix' : 'fixes'} made, ${flagged} to check by hand.`,
      nothingToFix: 'Nothing needed fixing. The file is as it was.',
      keepsNote:
        'Your citation keys, comments, order, and spacing are kept. Only the fixes listed below are made, in the text of your file.',
      switchesTitle: 'Habits that some styles rely on',
      switchesNote: 'They are off, so the file stays as you wrote it.',
      monthLabel: 'Write the month in its own field',
      monthHint: (n: number) =>
        n === 0
          ? 'No entry has the month written inside year.'
          : `${n} ${n === 1 ? 'entry has' : 'entries have'} the month written inside year, as in "Sep. 2025". The style ieeetr shows the month only when it is written there. Turn this on to give it a month field.`,
      copiesLabel: 'Remove a url and a note that only repeat the DOI',
      copiesHint: (n: number) =>
        n === 0
          ? 'No entry repeats its DOI in url or note.'
          : `${n} ${n === 1 ? 'entry repeats' : 'entries repeat'} the DOI in url or note. Some styles print the DOI from them. Turn this on to remove the copies.`,
      download: 'Download cleaned .bib',
      fixesTitle: (n: number) => `What was fixed (${n})`,
      flagsTitle: (n: number) => `To check by hand (${n})`,
      removed: 'removed',
      becomes: 'becomes',
      rules: {
        journal_period: 'A full stop after the closing bracket of the journal name was removed.',
        doi_prefix: 'The DOI is written without the link in front of it.',
        pages_dash: 'The page range is written with two hyphens.',
        et_al: '"et al." is written as "and others".',
        year_period: 'The year is written as a number.',
        month_from_year: 'The month was moved out of year into its own field.',
        drop_url_copy: 'The url was removed: it only repeated the DOI.',
        drop_note_copy: 'The note was removed: it only repeated the DOI.',
      },
      flags: {
        no_key: (_detail: string): string => 'This entry has no citation key.',
        duplicate_key: (_detail: string): string => 'This citation key is used by an earlier entry.',
        author_one_name: (_detail: string): string =>
          'The authors are written as one name (double braces), so BibTeX prints them as a single author. Write each author on their own, separated by "and".',
        duplicate_work: (other: string): string => `This looks like the same work as ${other}.`,
        looks_like_preprint: (journal: string): string =>
          `This is an @article, but its journal is "${journal}", a preprint server. A @misc entry may fit better.`,
        looks_like_proceedings: (journal: string): string =>
          `This is an @article, but its journal is "${journal}", which reads as a conference. An @inproceedings entry may fit better.`,
        number_zero: (_detail: string): string => 'The issue number is 0.',
        future_date: (date: string): string => `The date ${date} has not happened yet.`,
        missing_field: (fields: string): string => `Missing for this kind of entry: ${fields}.`,
      },
      newTitle: 'A new .bib from these references',
      newSummary: (entries: number, kept: number) =>
        `${entries} ${entries === 1 ? 'entry' : 'entries'} for the journal articles that could be read${
          kept === 0
            ? ''
            : kept === 1
              ? '. 1 reference that could not be made into an entry stays in the file as a comment'
              : `. ${kept} references that could not be made into entries stay in the file as comments`
        }.`,
      newNote:
        'Keys are made from the first author and the year. Check them before you use the file in a document.',
      nothingToWrite:
        'None of these references could be read as a journal article, so there is no entry to write.',
      downloadNew: 'Download as .bib',
      preview: 'Preview',
      previewLabel: 'The .bib file that would be downloaded',
      loadedNote:
        'The list comes from the file you loaded. To make a .bib from pasted references, clear the file first.',
      header:
        '% Made by CekKutip from references pasted as text. The keys were made automatically: check them before you use this file.',
      keptHeader: '% These references could not be made into entries:',
    },
  },
  split: {
    summary: (n: number) => `Review how your list was split (${n})`,
    hint: 'Each item is checked as one reference. Merge or edit any that were cut in the wrong place.',
    item: (n: number) => `Reference ${n}`,
    merge: 'Merge with previous',
    mergeLabel: (n: number) => `Merge reference ${n} with reference ${n - 1}`,
    edit: 'Edit',
    editLabel: (n: number) => `Edit reference ${n}`,
    editHint: 'Leave a blank line between references. Clear the text to remove one.',
    apply: 'Apply',
    cancel: 'Cancel',
    merged: (n: number, total: number) =>
      `Reference ${n} merged into reference ${n - 1}. ${total} found.`,
    updated: (total: number) => `Reference updated. ${total} found.`,
  },
  report: {
    title: 'CekKutip reference check',
    record: 'Record',
    totals:
      'Total {total}. Verified {verified}. Mismatch {mismatch}. Suspect {suspect}. Out-of-index {outOfIndex}. Could not check {checkFailed}.',
    tool: 'CekKutip {version}. Cut-offs: title {tauT}, authors {tauA}, low title {tauL}, venue {tauV}.',
    filename: 'cekkutip-report',
  },
  notFound: {
    h1: 'Page not found',
    text: 'This page does not exist. Go back to the checker.',
    link: 'Go to the checker',
  },
  dev: {
    todoBanner:
      'Placeholder values remain in site.config.ts. A production build will fail until they are filled in:',
  },
}

export type Dict = typeof en
