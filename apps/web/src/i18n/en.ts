import type { ReasonCode } from '@cekkutip/shared'

/**
 * English copy deck. This file defines the shape (`Dict`); id.ts must match it.
 * Verdict names are never translated. Their explanations are.
 * Placeholders in reason texts: {source} {n} {type}.
 */
export const en = {
  meta: {
    siteName: 'CekKutip',
    description:
      'Paste your reference list. CekKutip looks each reference up in Crossref and OpenAlex and tells you whether it exists, whether the details are right, or whether it cannot tell.',
    titles: {
      home: 'Check a reference list',
      how: 'How it works',
      evaluation: 'Evaluation',
      about: 'About',
      privacy: 'Privacy',
      notFound: 'Page not found',
    },
  },
  nav: {
    label: 'Main',
    check: 'Check',
    how: 'How it works',
    evaluation: 'Evaluation',
    about: 'About',
    language: 'Language',
    skip: 'Skip to content',
    switchTo: { en: 'Switch to English', id: 'Switch to Bahasa Indonesia' },
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
    verified: 'We found the work, and its title, authors, and year agree with your reference.',
    mismatch: 'We found the work, but some details you cited do not match the record.',
    suspect:
      'We could not find this work, although it is cited in a way that should make it findable. Check the source by hand.',
    out_of_index:
      'This kind of source is often missing from Crossref and OpenAlex, so we cannot tell. Check it by hand.',
  },
  reasons: {
    verified_all_match: 'Found in {source}. Title, authors, and year agree.',
    mismatch_authors: 'This work exists, but the authors you cited do not match the record.',
    mismatch_year: 'This work exists, but the year differs by {n} years.',
    mismatch_venue: 'This work exists, but it was published in a different journal.',
    mismatch_doi_other_work: 'This DOI leads to a different work than the one you cited.',
    suspect_doi_not_found:
      'This DOI is not registered. Check the source by hand before you keep it.',
    suspect_no_record_journal:
      'We could not find this work, although it is cited like a journal article. Check the source by hand.',
    out_of_index_type:
      'This looks like a {type}. Crossref and OpenAlex often do not hold these, so we cannot check it. Check it by hand.',
    out_of_index_insufficient_data:
      'There is not enough detail to search. Add the title and authors.',
    out_of_index_other_registry:
      'This DOI belongs to a registry we do not search yet. Open it to check.',
    check_failed_network: 'The lookup service did not respond. This is not a verdict. Try again.',
  } satisfies Record<ReasonCode, string>,
  home: {
    h1: 'Check a reference list before you submit it.',
    intro:
      'Paste your references. CekKutip looks each one up and tells you whether it exists, whether the details are right, or whether it cannot tell.',
    inputLabel: 'References',
    found: (n: number) => `${n} found`,
    placeholderHint: 'Paste one reference per paragraph, or number them.',
    noAi: 'Do not send my text to an AI service (less accurate)',
    notice:
      'By default, your text is sent to Google Gemini to read the fields (author, year, title). Titles and authors are then looked up in Crossref and OpenAlex. We do not store your text.',
    noticeLink: 'Read the privacy details',
    check: 'Check references',
    example: 'Try an example',
    clear: 'Clear',
    resultsTitle: 'Results',
    emptyHint:
      'Paste your references on the left and choose Check references. Results appear here, one by one.',
    emptyLegend: 'What the four verdicts mean',
    statement: 'Verdicts are prompts for review, not findings of misconduct.',
    verdictsTitle: 'The four verdicts',
    howTitle: 'How a check works',
    howMore: 'See a full example',
    steps: [
      {
        name: 'Parse',
        text: 'A language model reads each reference and extracts its fields. It never decides if the reference is real.',
      },
      { name: 'Retrieve', text: 'We look the work up in Crossref, and in OpenAlex if needed.' },
      { name: 'Match', text: 'We compare title, authors, year, and venue.' },
      { name: 'Decide', text: 'Fixed rules turn the comparison into one of four verdicts.' },
    ],
    notTitle: 'What CekKutip does not do',
    notItems: [
      'It does not check whether a source supports your claim.',
      'It does not detect plagiarism.',
      'It cannot see books, theses, and reports that Crossref and OpenAlex do not hold, so it says so instead of guessing.',
      'It is not proof of misconduct, and it is not a replacement for reading your sources.',
    ],
  },
  how: {
    h1: 'How a check works',
    lede: 'A check has four steps. Only the first one uses a language model, and it never decides whether a reference is real.',
    diagramTitle: 'The four steps',
    diagramDesc:
      'Four steps in a row: Parse, Retrieve, Match, Decide. Only Parse uses a language model. The other three are fixed code.',
    diagramSteps: [
      { name: 'Parse', note: 'Reads the fields', tag: 'Language model' },
      { name: 'Retrieve', note: 'Crossref, then OpenAlex', tag: 'No model' },
      { name: 'Match', note: 'Compares four fields', tag: 'No model' },
      { name: 'Decide', note: 'Fixed rules, one verdict', tag: 'No model' },
    ],
    diagramNote:
      'The model only turns text into fields. It does not look anything up and it does not choose the verdict.',
    exampleTitle: 'One reference, step by step',
    exampleIntro:
      'We took a real reference and changed two details, the year and the journal, to show what a Mismatch looks like.',
    exampleCitedLabel: 'The reference as pasted',
    exampleSteps: [
      {
        name: 'Parse',
        text: 'The model reads the text and returns fields: two authors, the year 2021, a title, and a journal name. It adds nothing that is not written there.',
      },
      {
        name: 'Retrieve',
        text: 'There is no DOI, so we search Crossref by title, first author, and year. It returns a record with the same title.',
      },
      {
        name: 'Match',
        text: 'We compare each field with the record. The title and authors agree. The year differs by two years, and the journal is not the same.',
      },
      {
        name: 'Decide',
        text: 'The title matches, but the year and journal do not. The rule for this case gives Mismatch, with the reasons shown next to it.',
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
      'The first rule that applies decides the result. What counts as a matching title or matching authors is set by cut-off values. We tune them on practice data only, then freeze them before the final test.',
    rulesColIf: 'If',
    rulesColResult: 'Result',
    rules: [
      { if: 'A lookup service did not respond after retries.', result: 'check_failed' },
      { if: 'The reference has a DOI that is not registered anywhere.', result: 'suspect' },
      { if: 'The DOI leads to a record with a very different title.', result: 'mismatch' },
      { if: 'A record matches on title, authors, year, and journal.', result: 'verified' },
      {
        if: 'A record matches on title, but the authors, year, or journal differ.',
        result: 'mismatch',
      },
      {
        if: 'It is cited like a journal article, and no record is close enough.',
        result: 'suspect',
      },
      {
        if: 'It is a book, chapter, thesis, report, web page, or other source, and no record is close enough.',
        result: 'out_of_index',
      },
      { if: 'There is too little detail to search.', result: 'out_of_index' },
      { if: 'The DOI belongs to a registry we do not search yet.', result: 'out_of_index' },
    ],
    checkFailedNote:
      'Could not check is a status, not a verdict. It never counts against a reference.',
    limitsTitle: 'Limits',
    limits: [
      'Crossref and OpenAlex are incomplete. A real source can be missing from both. That is why Out-of-index exists.',
      'Records can contain errors too. A Verified result means the work exists and the details agree, not that your source supports your claim.',
      'The model can misread an unusual reference format. If it fails, the regex reader takes over for that reference.',
      'Verdicts are prompts for review, not findings of misconduct.',
    ],
  },
  evaluation: {
    h1: 'Evaluation',
    lede: 'We test CekKutip in two ways: on a labelled set of references, and with students.',
    loading: 'Loading results',
    emptyTitle: 'No results yet',
    empty: 'Results will be published after data lock on 9 December 2026.',
    emptyNote:
      'Until then this page shows no numbers, because we have no measured results to show.',
    technicalTitle: 'Technical evaluation',
    technical:
      'We label a set of references by hand, with two people labelling each one. CekKutip and three simpler baselines are then run on references that were held out until the end. We also switch parts of CekKutip off, one at a time, to see what each part adds.',
    userTitle: 'User study',
    user: 'A short study with students looks at whether the tool helps people find problems in a reference list, and how they judge its explanations.',
    metricsTitle: 'What we will report',
    metrics: [
      'Macro-F1 across the four verdicts, with 95% confidence intervals.',
      'Precision, recall, and F1 for each verdict.',
      'False accusation rate: how often a source that is real, or only missing from the indexes, is marked Suspect or Mismatch.',
      'Abstain rate: how often the tool answers Out-of-index.',
      'Median time per reference, and cost per 1,000 references.',
      'Agreement between the two people who labelled the references (Cohen kappa).',
      'Results with and without references that were altered on purpose for testing.',
    ],
  },
  about: {
    h1: 'About CekKutip',
    lede: 'A reference checker built by students, for students.',
    storyTitle: 'Why we built it',
    story:
      'AI assistants can write references that look complete but point to nothing, or that carry the wrong author, year, or journal. Students often cannot tell which ones to trust, and most checkers only return a match or a score. CekKutip adds two things: Mismatch, for real works that were cited wrongly, and Out-of-index, for sources it cannot see. That way a student is not accused of a mistake the tool cannot actually find.',
    teamTitle: 'Team',
    supervisorTitle: 'Supervisor',
    universityTitle: 'University',
    competitionTitle: 'Competition',
    competition:
      'Built for the Global Youth Invention and Innovation Fair (GYIIF) 2027, hosted by IPB University. Category: Engineering and Technology. Online track.',
    limitsTitle: 'Limits',
    limits: 'CekKutip cannot see everything. Read what it does not do on the How it works page.',
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
        text: 'Metadata for scholarly works, looked up by DOI or by title.',
      },
      {
        name: 'OpenAlex',
        url: 'https://openalex.org/',
        text: 'A second index, used when Crossref has no close record.',
      },
      {
        name: 'Google Gemini',
        url: 'https://ai.google.dev/',
        text: 'Reads each reference and extracts its fields. It does not decide any verdict.',
      },
    ],
  },
  privacy: {
    h1: 'Privacy',
    lede: 'What happens to the text you paste, in plain words.',
    items: [
      'By default, your reference text is sent to Google Gemini. It is used only to read the fields: authors, year, title. Choose "Do not send my text to an AI service" to avoid this. Results are then less accurate.',
      'Google states that content sent through its free tier can be used to improve its products, and that human reviewers may read it.',
      'The title, authors, and DOI that were read from your references are sent to Crossref and OpenAlex, and to DataCite when needed, to look the work up.',
      'Our server does not store your text. Our logs hold only a request id, the number of references, timings, and error codes. They never hold your text.',
      'We follow the principles of Indonesian Law No. 27 of 2022 on Personal Data Protection: collect little, use it for one purpose, and keep nothing we do not need. This describes our approach. It is not a statement of legal compliance.',
      'Do not paste sensitive or personal information. A reference list does not need any.',
    ],
    googleTerms: "Read Google's terms for the Gemini API",
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
