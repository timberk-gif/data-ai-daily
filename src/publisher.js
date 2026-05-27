/**
 * RSS Feed Publisher
 *
 * Builds or updates an RSS 2.0 feed with iTunes podcast tags
 */

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build or update RSS 2.0 feed
 *
 * @param {string} existingFeedXml - Current feed.xml contents (empty string if first run)
 * @param {object} episode - { title, date, fileName, fileSizeBytes, durationSeconds, description }
 * @param {string} baseUrl - e.g. "https://username.github.io/repo-name"
 * @param {object} podcastInfo - { title, author, description }
 * @returns {string} Updated feed XML
 */
function buildUpdatedFeed(existingFeedXml, episode, baseUrl, podcastInfo) {
  const episodeUrl = `${baseUrl}/episodes/${episode.fileName}`;
  // Use noon CDT (17:00 UTC) so the episode date is unambiguous for listeners in any timezone
  const pubDate = new Date(`${episode.date}T17:00:00Z`).toUTCString();

  const newItem = `
    <item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.description)}</description>
      <itunes:summary>${escapeXml(episode.description)}</itunes:summary>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${episodeUrl}" length="${episode.fileSizeBytes}" type="audio/mpeg"/>
      <guid isPermaLink="true">${episodeUrl}</guid>
      <itunes:duration>${episode.durationSeconds}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
    </item>`;

  if (!existingFeedXml || existingFeedXml.trim() === '') {
    // First run — build the full feed from scratch
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(podcastInfo.title)}</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(podcastInfo.description)}</description>
    <itunes:summary>${escapeXml(podcastInfo.description)}</itunes:summary>
    <language>en-us</language>
    <itunes:image href="${baseUrl}/artwork.jpg"/>
    <itunes:author>${escapeXml(podcastInfo.author)}</itunes:author>
    <itunes:email>${escapeXml(podcastInfo.ownerEmail)}</itunes:email>
    <itunes:owner>
      <itunes:name>${escapeXml(podcastInfo.author)}</itunes:name>
      <itunes:email>${escapeXml(podcastInfo.ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:category text="Technology"/>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    ${newItem}
  </channel>
</rss>`;
  }

  // Subsequent runs — insert new item after the channel metadata block
  // Find the channel-level <itunes:type>...</itunes:type> close (new feeds)
  // Fall back to the channel-level </itunes:explicit> for older feeds without itunes:type
  let insertPosition = existingFeedXml.indexOf('</itunes:type>');
  if (insertPosition === -1) {
    insertPosition = existingFeedXml.indexOf('</itunes:explicit>');
  }
  if (insertPosition === -1) {
    throw new Error('Invalid feed XML: missing channel-metadata anchor tag');
  }

  const insertPoint = existingFeedXml.indexOf('>', insertPosition) + 1;

  return (
    existingFeedXml.slice(0, insertPoint) +
    newItem +
    existingFeedXml.slice(insertPoint)
  );
}

module.exports = { buildUpdatedFeed };
