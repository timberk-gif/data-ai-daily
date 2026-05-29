/**
 * Content Fetcher
 *
 * Fetches content from Databricks and AI/ML news sources
 */

const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// ============================================================================
// DATABRICKS SOURCES
// ============================================================================

/**
 * Fetch recent Databricks release notes
 */
async function fetchDatabricksReleaseNotes() {
  console.log('Fetching Databricks release notes...');

  try {
    const { data } = await axios.get('https://docs.databricks.com/en/release-notes/index.html', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const items = [];

    $('article').slice(0, 5).each((_, el) => {
      const title = $(el).find('h1, h2, h3').first().text().trim();
      const summary = $(el).find('p').first().text().trim().slice(0, 300);
      const date = $(el).find('time, .date').text().trim();

      if (title) {
        items.push({ title, summary, date, source: 'Databricks Release Notes' });
      }
    });

    console.log(`  Found ${items.length} release notes`);
    return items;
  } catch (error) {
    console.error('Error fetching Databricks release notes:', error.message);
    return [];
  }
}

/**
 * Fetch recent Databricks blog posts (RSS)
 */
async function fetchDatabricksBlog() {
  console.log('Fetching Databricks blog posts...');

  try {
    const { data } = await axios.get('https://www.databricks.com/feed', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    const $ = cheerio.load(data, { xmlMode: true });
    const items = [];

    $('item').slice(0, 5).each((_, el) => {
      const title = $(el).find('title').text().trim();
      const description = $(el).find('description').text().trim()
        .replace(/<[^>]*>/g, '')
        .slice(0, 300);
      const pubDate = $(el).find('pubDate').text().trim();

      if (title) {
        items.push({ title, summary: description, date: pubDate, source: 'Databricks Blog' });
      }
    });

    console.log(`  Found ${items.length} blog posts`);
    return items;
  } catch (error) {
    console.error('Error fetching Databricks blog:', error.message);
    return [];
  }
}

/**
 * Fetch Databricks newsroom (press releases & announcements)
 */
async function fetchDatabricksNewsroom() {
  console.log('Fetching Databricks newsroom...');

  try {
    const { data } = await axios.get('https://www.databricks.com/company/newsroom', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const items = [];

    // Correct selectors based on actual page structure
    $('div[data-cy="CtaImageBlock"]').slice(0, 5).each((_, el) => {
      const title = $(el).find('h3.h3 a').text().trim();
      const date = $(el).find('p.h4').text().trim();
      const url = $(el).find('h3.h3 a').attr('href');

      if (title) {
        items.push({
          title,
          summary: title, // No separate summary on listing page
          date,
          source: 'Databricks Newsroom',
          url
        });
      }
    });

    console.log(`  Found ${items.length} newsroom items`);
    return items;
  } catch (error) {
    console.error('Error fetching Databricks newsroom:', error.message);
    return [];
  }
}

/**
 * Fetch tweets from Databricks exec team
 * Includes: Ali Ghodsi (CEO), Reynold Xin (Chief Architect), Matei Zaharia (CTO)
 * Requires TWITTER_BEARER_TOKEN environment variable
 */
async function fetchDatabricksExecTweets() {
  const token = process.env.TWITTER_BEARER_TOKEN;

  if (!token) {
    console.log('  Skipping Twitter (no TWITTER_BEARER_TOKEN set)');
    return { items: [], apiCalls: 0 };
  }

  console.log('Fetching Databricks exec tweets...');

  try {
    // Databricks co-founders and executive team Twitter handles
    const users = ['alighodsi', 'rxin', 'matei_zaharia'];
    const items = [];
    let apiCalls = 0;

    for (const username of users) {
      try {
        // Get user ID first
        const userRes = await axios.get(
          `https://api.twitter.com/2/users/by/username/${username}`,
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
        );
        apiCalls++; // Count user lookup API call

        if (!userRes.data?.data?.id) {
          console.warn(`  Warning: invalid Twitter response for @${username}, skipping`);
          continue;
        }
        const userId = userRes.data.data.id;

        // Get recent tweets
        const tweetsRes = await axios.get(
          `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at`,
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
        );
        apiCalls++; // Count tweets fetch API call

        const tweets = tweetsRes.data.data || [];

        for (const tweet of tweets.slice(0, 3)) {
          items.push({
            title: `@${username}: ${tweet.text.slice(0, 100)}...`,
            summary: tweet.text.slice(0, 300),
            date: tweet.created_at,
            source: `Twitter (@${username})`
          });
        }
      } catch (err) {
        console.error(`  Error fetching tweets from @${username}:`, err.message);
      }
    }

    console.log(`  Found ${items.length} exec tweets (${apiCalls} API calls)`);
    return { items, apiCalls };
  } catch (error) {
    console.error('Error fetching exec tweets:', error.message);
    return { items: [], apiCalls: 0 };
  }
}

// ============================================================================
// AI/ML NEWS SOURCES
// ============================================================================

/**
 * Fetch from RSS feed helper
 */
async function fetchRSSFeed(url, sourceName, maxItems = 5) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    const $ = cheerio.load(data, { xmlMode: true });
    const items = [];

    $('item').slice(0, maxItems).each((_, el) => {
      const title = $(el).find('title').text().trim();
      const description = $(el).find('description').text().trim()
        .replace(/<[^>]*>/g, '')
        .slice(0, 300);
      const pubDate = $(el).find('pubDate').text().trim();

      if (title) {
        items.push({ title, summary: description, date: pubDate, source: sourceName });
      }
    });

    return items;
  } catch (error) {
    console.error(`Error fetching ${sourceName}:`, error.message);
    return [];
  }
}

/**
 * Scrape blog posts from a page
 */
async function scrapeBlog(url, sourceName, selectors, maxItems = 5) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const items = [];

    $(selectors.container).slice(0, maxItems).each((_, el) => {
      const title = $(el).find(selectors.title).first().text().trim();
      const summary = $(el).find(selectors.summary).first().text().trim().slice(0, 300);
      const date = $(el).find(selectors.date).first().text().trim();

      if (title) {
        items.push({ title, summary, date, source: sourceName });
      }
    });

    return items;
  } catch (error) {
    console.error(`Error scraping ${sourceName}:`, error.message);
    return [];
  }
}

/**
 * Fetch OpenAI blog
 */
async function fetchOpenAIBlog() {
  console.log('Fetching OpenAI blog...');
  // Scraping openai.com/blog returns 403 (bot protection). The blog moved to
  // /news and exposes a stable RSS feed, so pull that instead of scraping HTML.
  return fetchRSSFeed('https://openai.com/news/rss.xml', 'OpenAI Blog', 5);
}

/**
 * Fetch Anthropic news
 */
async function fetchAnthropicNews() {
  console.log('Fetching Anthropic news...');

  try {
    const { data } = await axios.get('https://www.anthropic.com/news', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const items = [];

    // Correct selectors based on actual page structure
    $('a.PublicationList-module-scss-module__KxYrHG__listItem').slice(0, 5).each((_, el) => {
      const title = $(el).find('span.PublicationList-module-scss-module__KxYrHG__title').text().trim();
      const category = $(el).find('span.PublicationList-module-scss-module__KxYrHG__subject').text().trim();
      const date = $(el).find('time.PublicationList-module-scss-module__KxYrHG__date').text().trim();
      const url = $(el).attr('href');

      if (title) {
        items.push({
          title,
          summary: category ? `${category}: ${title}` : title,
          date,
          source: 'Anthropic News',
          url: url.startsWith('http') ? url : `https://www.anthropic.com${url}`
        });
      }
    });

    console.log(`  Found ${items.length} news items`);
    return items;
  } catch (error) {
    console.error('Error fetching Anthropic news:', error.message);
    return [];
  }
}

/**
 * Fetch Google DeepMind blog
 */
async function fetchDeepMindBlog() {
  console.log('Fetching DeepMind blog...');
  return scrapeBlog(
    'https://deepmind.google/discover/blog/',
    'Google DeepMind',
    { container: 'article, .blog-post', title: 'h2, h3, .title', summary: 'p', date: 'time, .date' },
    5
  );
}

/**
 * Fetch Meta AI blog
 */
async function fetchMetaAIBlog() {
  console.log('Fetching Meta AI blog...');
  return scrapeBlog(
    'https://ai.meta.com/blog/',
    'Meta AI',
    { container: 'article, .blog-item', title: 'h2, h3, .title', summary: 'p', date: 'time, .date' },
    5
  );
}

/**
 * Fetch The Verge AI RSS
 */
async function fetchVergeAI() {
  console.log('Fetching The Verge AI...');
  return fetchRSSFeed(
    'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    'The Verge AI',
    5
  );
}

/**
 * Fetch TechCrunch AI RSS
 */
async function fetchTechCrunchAI() {
  console.log('Fetching TechCrunch AI...');
  return fetchRSSFeed(
    'https://techcrunch.com/category/artificial-intelligence/feed/',
    'TechCrunch AI',
    5
  );
}

/**
 * Fetch VentureBeat AI RSS
 */
async function fetchVentureBeatAI() {
  console.log('Fetching VentureBeat AI...');
  return fetchRSSFeed(
    'https://venturebeat.com/category/ai/feed/',
    'VentureBeat AI',
    5
  );
}

/**
 * Fetch Hacker News AI stories
 */
async function fetchHackerNewsAI() {
  console.log('Fetching Hacker News AI stories...');

  try {
    const { data: topStories } = await axios.get(
      'https://hacker-news.firebaseio.com/v0/topstories.json',
      { timeout: 10000 }
    );

    const items = [];
    const aiKeywords = ['ai', 'ml', 'machine learning', 'deep learning', 'llm', 'gpt',
                        'neural', 'artificial intelligence', 'openai', 'anthropic', 'claude',
                        'databricks'];

    const storyPromises = topStories.slice(0, 30).map(id =>
      axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 10000 })
        .then(res => res.data)
        .catch(() => null)
    );

    const stories = await Promise.all(storyPromises);

    for (const story of stories) {
      if (!story || !story.title) continue;

      const titleLower = story.title.toLowerCase();
      const isAIRelated = aiKeywords.some(kw => titleLower.includes(kw));

      if (isAIRelated && items.length < 5) {
        items.push({
          title: story.title,
          summary: story.title,
          date: new Date(story.time * 1000).toLocaleDateString(),
          source: 'Hacker News'
        });
      }
    }

    console.log(`  Found ${items.length} AI stories`);
    return items;
  } catch (error) {
    console.error('Error fetching Hacker News:', error.message);
    return [];
  }
}

/**
 * Fetch arXiv CS.AI papers (RSS)
 */
async function fetchArxivAI() {
  console.log('Fetching arXiv AI papers...');
  return fetchRSSFeed(
    'https://export.arxiv.org/rss/cs.AI',
    'arXiv CS.AI',
    3
  );
}

// ============================================================================
// COMPETITIVE SOURCES (Snowflake, Microsoft Fabric, Google BigQuery)
// ============================================================================

/**
 * Fetch Snowflake blog by scraping HTML (no public RSS as of 2026; blog feed returns 403/404)
 */
async function fetchSnowflakeBlog() {
  console.log('Fetching Snowflake blog...');
  try {
    const { data } = await axios.get('https://www.snowflake.com/en/blog/', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const items = [];
    // Snowflake blog cards use article-like containers; pull titles + summaries from headings + nearby text
    $('article, .card, [class*="post"], [class*="article"]').slice(0, 8).each((_, el) => {
      const title = $(el).find('h2, h3, h4, .title').first().text().trim();
      const summary = $(el).find('p, .excerpt, .description').first().text().trim().slice(0, 300);
      if (title && title.length > 10) {
        items.push({ title, summary, date: '', source: 'Snowflake Blog' });
      }
    });
    // Dedupe by title
    const seen = new Set();
    const unique = items.filter(i => { if (seen.has(i.title)) return false; seen.add(i.title); return true; }).slice(0, 5);
    console.log(`  Found ${unique.length} Snowflake posts`);
    return unique;
  } catch (error) {
    console.error('Error fetching Snowflake blog:', error.message);
    return [];
  }
}

/**
 * Fetch Microsoft Fabric blog (RSS)
 */
async function fetchFabricBlog() {
  console.log('Fetching Microsoft Fabric blog...');
  return fetchRSSFeed('https://blog.fabric.microsoft.com/en-US/blog/feed/', 'Microsoft Fabric Blog', 5);
}

/**
 * Fetch Google Cloud Data Analytics blog (RSS) — covers BigQuery + analytics products
 */
async function fetchGoogleCloudDataBlog() {
  console.log('Fetching Google Cloud Data & Analytics blog...');
  return fetchRSSFeed('https://cloudblog.withgoogle.com/products/data-analytics/rss/', 'Google Cloud Data Blog', 5);
}

/**
 * Fetch ClickHouse blog — Next.js site, no public RSS, but __NEXT_DATA__ has structured posts
 */
async function fetchClickHouseBlog() {
  console.log('Fetching ClickHouse blog...');
  try {
    const { data } = await axios.get('https://clickhouse.com/blog', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 15000,
    });
    const $ = cheerio.load(data);
    const nextDataText = $('#__NEXT_DATA__').html();
    if (!nextDataText) {
      console.error('  ClickHouse: no __NEXT_DATA__ found in HTML');
      return [];
    }
    const nextData = JSON.parse(nextDataText);

    const items = [];
    const seen = new Set();

    const looksLikePersonName = (title) => {
      const parts = title.trim().split(/\s+/);
      if (parts.length > 3) return false;
      return parts.every((p) => /^[A-Z][a-zA-Záàâäéèêëíìîïóòôöúùûüñç'-]+$/.test(p));
    };

    const walk = (obj) => {
      if (Array.isArray(obj)) return obj.forEach(walk);
      if (obj && typeof obj === 'object') {
        if (obj.slug && obj.title && (obj.publishedAt || obj.date)) {
          const { slug, title } = obj;
          if (!seen.has(slug) && !looksLikePersonName(title) && title.length >= 15) {
            seen.add(slug);
            items.push({
              title,
              summary: (obj.description || obj.excerpt || obj.summary || '').toString().slice(0, 300),
              date: obj.publishedAt || obj.date,
              source: 'ClickHouse Blog',
            });
          }
        }
        Object.values(obj).forEach(walk);
      }
    };
    walk(nextData);

    // Most recent first, top 5
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    const top = items.slice(0, 5);
    console.log(`  Found ${top.length} ClickHouse posts`);
    return top;
  } catch (error) {
    console.error('Error fetching ClickHouse blog:', error.message);
    return [];
  }
}

// ============================================================================
// FINANCIAL SERVICES + INSURANCE INDUSTRY SOURCES
// ============================================================================

/**
 * Fetch Insurance Journal (RSS) — insurance industry news
 */
async function fetchInsuranceJournal() {
  console.log('Fetching Insurance Journal...');
  return fetchRSSFeed('https://www.insurancejournal.com/rss/news/', 'Insurance Journal', 4);
}

/**
 * Fetch Banking Dive (RSS) — bank + credit union industry coverage
 */
async function fetchBankingDive() {
  console.log('Fetching Banking Dive...');
  return fetchRSSFeed('https://www.bankingdive.com/feeds/news/', 'Banking Dive', 4);
}

/**
 * Fetch American Banker (RSS) — banking industry coverage
 */
async function fetchAmericanBanker() {
  console.log('Fetching American Banker...');
  return fetchRSSFeed('https://www.americanbanker.com/feed.rss', 'American Banker', 4);
}

/**
 * Fetch PYMNTS (RSS) — fintech + payments industry coverage
 */
async function fetchPYMNTS() {
  console.log('Fetching PYMNTS...');
  return fetchRSSFeed('https://www.pymnts.com/feed/', 'PYMNTS', 4);
}

// ============================================================================
// COMMUNITY SENTIMENT SOURCES (REDDIT)
// ============================================================================

// Vendor / product keywords used to filter general subreddits for relevant posts.
// Vendor-specific subreddits (see VENDOR_SUBREDDITS) bypass this filter — the
// subreddit itself is already on-topic.
const COMMUNITY_KEYWORDS = [
  'databricks', 'snowflake', 'fabric', 'bigquery', 'redshift',
  'clickhouse', 'delta lake', 'unity catalog', 'lakebase', 'mlflow',
  'lakehouse', 'iceberg', 'dbt'
];

// Subreddits whose entire content is on-topic; skip keyword filtering for these.
const VENDOR_SUBREDDITS = new Set(['databricks', 'snowflake', 'clickhouse']);

function postMatchesKeywords(text) {
  const lower = text.toLowerCase();
  return COMMUNITY_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Fetch top posts of the day from one subreddit via Reddit's public JSON.
 *
 * General subreddits are filtered to posts mentioning a tracked vendor keyword;
 * vendor-specific subreddits (r/databricks, r/snowflake) return all top posts.
 *
 * Usernames are intentionally omitted — we surface themes for the script,
 * not individual quotes. Reddit's API terms restrict commercial use, so the
 * synthesizer is instructed to paraphrase, not quote verbatim.
 */
async function fetchReddit(subreddit, maxItems = 8) {
  console.log(`Fetching Reddit r/${subreddit}...`);

  try {
    const { data } = await axios.get(
      `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=25`,
      {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      }
    );

    const posts = (data?.data?.children || []).map(c => c.data);
    const isVendorSub = VENDOR_SUBREDDITS.has(subreddit.toLowerCase());

    const items = posts
      .filter(p => !p.stickied && !p.over_18)
      .filter(p => isVendorSub || postMatchesKeywords(`${p.title} ${p.selftext || ''}`))
      .slice(0, maxItems)
      .map(p => {
        const body = (p.selftext || '').replace(/\s+/g, ' ').slice(0, 300);
        const signal = `${p.score} upvotes, ${p.num_comments} comments`;
        return {
          title: p.title,
          summary: body ? `${signal}. ${body}` : signal,
          date: new Date(p.created_utc * 1000).toISOString(),
          source: `Reddit r/${subreddit}`
        };
      });

    console.log(`  Found ${items.length} relevant posts`);
    return items;
  } catch (error) {
    console.error(`Error fetching Reddit r/${subreddit}:`, error.message);
    return [];
  }
}

// ============================================================================
// MAIN EXPORT FUNCTIONS
// ============================================================================

/**
 * Fetch all Databricks content
 */
async function fetchDatabricksContent() {
  const [releaseNotes, blog, newsroom, execTweets] = await Promise.all([
    fetchDatabricksReleaseNotes(),
    fetchDatabricksBlog(),
    fetchDatabricksNewsroom(),
    fetchDatabricksExecTweets()
  ]);

  return {
    items: [...releaseNotes, ...blog, ...newsroom, ...execTweets.items],
    twitterApiCalls: execTweets.apiCalls
  };
}

/**
 * Fetch all AI/ML news
 */
async function fetchAINews() {
  const [
    openai, anthropic, deepmind, meta,
    verge, techcrunch, venturebeat,
    hn, arxiv
  ] = await Promise.all([
    fetchOpenAIBlog(),
    fetchAnthropicNews(),
    fetchDeepMindBlog(),
    fetchMetaAIBlog(),
    fetchVergeAI(),
    fetchTechCrunchAI(),
    fetchVentureBeatAI(),
    fetchHackerNewsAI(),
    fetchArxivAI()
  ]);

  return [...openai, ...anthropic, ...deepmind, ...meta, ...verge, ...techcrunch, ...venturebeat, ...hn, ...arxiv];
}

/**
 * Fetch all competitive content (Snowflake, Fabric, BigQuery)
 */
async function fetchCompetitiveContent() {
  const [snowflake, fabric, bigquery, clickhouse] = await Promise.all([
    fetchSnowflakeBlog(),
    fetchFabricBlog(),
    fetchGoogleCloudDataBlog(),
    fetchClickHouseBlog(),
  ]);
  return [...snowflake, ...fabric, ...bigquery, ...clickhouse];
}

/**
 * Fetch all financial services + insurance industry content
 */
async function fetchFSIContent() {
  const [insurance, bankingDive, americanBanker, pymnts] = await Promise.all([
    fetchInsuranceJournal(),
    fetchBankingDive(),
    fetchAmericanBanker(),
    fetchPYMNTS(),
  ]);
  return [...insurance, ...bankingDive, ...americanBanker, ...pymnts];
}

/**
 * Fetch community sentiment from a curated set of subreddits.
 *
 * Vendor-specific subs (r/databricks, r/snowflake) return all top-of-day posts;
 * general subs are keyword-filtered for vendor mentions.
 */
async function fetchCommunitySentiment() {
  const subs = [
    'databricks',
    'snowflake',
    'clickhouse',
    'dataengineering',
    'MachineLearning',
    'datascience',
    'analytics'
  ];

  const results = await Promise.all(subs.map(s => fetchReddit(s)));
  return results.flat();
}

module.exports = {
  fetchDatabricksReleaseNotes,
  fetchDatabricksBlog,
  fetchDatabricksContent,
  fetchAINews,
  fetchCompetitiveContent,
  fetchFSIContent,
  fetchReddit,
  fetchCommunitySentiment,
};
