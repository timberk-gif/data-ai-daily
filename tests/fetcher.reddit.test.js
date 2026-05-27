'use strict';

jest.mock('axios');
const axios = require('axios');

const { fetchReddit } = require('../src/fetcher');

function fakePost({
  title,
  selftext = '',
  score = 42,
  num_comments = 7,
  stickied = false,
  over_18 = false,
  created_utc = 1716800000
}) {
  return { data: { title, selftext, score, num_comments, stickied, over_18, created_utc } };
}

function fakeListing(posts) {
  return { data: { data: { children: posts } } };
}

// ─────────────────────────────────────────────
// Vendor-specific subreddit — no keyword filter
// ─────────────────────────────────────────────

describe('fetchReddit — vendor-specific subreddit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns all top posts from r/databricks without keyword filtering', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'Anyone using Lakebase in prod yet?' }),
      fakePost({ title: 'Random thought about my coffee maker' }),
    ]));

    const items = await fetchReddit('databricks');

    expect(items).toHaveLength(2);
    expect(items[0].source).toBe('Reddit r/databricks');
  });

  test('vendor sub match is case-insensitive', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'Nothing about vendors at all' }),
    ]));

    const items = await fetchReddit('Snowflake');

    expect(items).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
// General subreddit — keyword filter applies
// ─────────────────────────────────────────────

describe('fetchReddit — general subreddit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps posts mentioning a tracked vendor keyword', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'Migrating from Redshift to Databricks — anyone done this?' }),
      fakePost({ title: 'Best framework for unit tests in Python?' }),
      fakePost({ title: 'Snowflake pricing changes incoming' }),
    ]));

    const items = await fetchReddit('dataengineering');

    expect(items).toHaveLength(2);
    expect(items.map(i => i.title)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Redshift'),
        expect.stringContaining('Snowflake'),
      ])
    );
  });

  test('keyword match is case-insensitive', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'Question about DELTA LAKE behavior' }),
    ]));

    const items = await fetchReddit('dataengineering');

    expect(items).toHaveLength(1);
  });

  test('matches keywords in the body, not just the title', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'Generic question', selftext: 'I am evaluating Lakebase for my use case' }),
    ]));

    const items = await fetchReddit('dataengineering');

    expect(items).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
// Filtering edge cases
// ─────────────────────────────────────────────

describe('fetchReddit — filtering edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('drops stickied posts', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'Welcome to r/databricks — please read', stickied: true }),
      fakePost({ title: 'Real question about MLflow' }),
    ]));

    const items = await fetchReddit('databricks');

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Real question about MLflow');
  });

  test('drops NSFW posts', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'Spicy take on Databricks pricing', over_18: true }),
    ]));

    const items = await fetchReddit('databricks');

    expect(items).toHaveLength(0);
  });

  test('respects maxItems cap', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      fakePost({ title: `Snowflake post ${i}` })
    );
    axios.get.mockResolvedValueOnce(fakeListing(many));

    const items = await fetchReddit('dataengineering', 5);

    expect(items).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────
// Shape + graceful degradation
// ─────────────────────────────────────────────

describe('fetchReddit — output shape and errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns items with title, summary, date, source', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'Databricks question', score: 100, num_comments: 25 }),
    ]));

    const items = await fetchReddit('databricks');

    expect(items[0]).toEqual(expect.objectContaining({
      title: 'Databricks question',
      source: 'Reddit r/databricks',
    }));
    expect(items[0].summary).toMatch(/100 upvotes, 25 comments/);
    expect(items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('summary includes body excerpt when present', async () => {
    axios.get.mockResolvedValueOnce(fakeListing([
      fakePost({ title: 'A title', selftext: 'A body about Databricks performance.' }),
    ]));

    const items = await fetchReddit('databricks');

    expect(items[0].summary).toMatch(/A body about Databricks performance\./);
  });

  test('returns empty array on fetch error (graceful degradation)', async () => {
    axios.get.mockRejectedValueOnce(new Error('network down'));

    const items = await fetchReddit('databricks');

    expect(items).toEqual([]);
  });

  test('returns empty array when API returns unexpected shape', async () => {
    axios.get.mockResolvedValueOnce({ data: {} });

    const items = await fetchReddit('databricks');

    expect(items).toEqual([]);
  });
});
