import { DatabaseService } from "./database";
import { Conference } from "./types";

/**
 * Levenshtein distance algorithm for string similarity
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two conference names
 */
function calculateSimilarity(query: string, candidate: string): number {
  const queryNormalized = query.toLowerCase().trim();
  const candidateNormalized = candidate.toLowerCase().trim();

  // Calculate distance
  const distance = levenshteinDistance(queryNormalized, candidateNormalized);
  const maxLength = Math.max(queryNormalized.length, candidateNormalized.length);

  // Return similarity score (1 = perfect match, 0 = completely different)
  return maxLength === 0 ? 1.0 : 1 - distance / maxLength;
}

/**
 * Find best matching conference for a given name
 */
export async function findBestMatchingConference(
  conferenceName: string,
  similarityThreshold = 0.6
): Promise<{
  found: boolean;
  conference?: Conference;
  similarity?: number;
  suggestions?: Conference[];
}> {
  // Get all conferences from database
  const db = DatabaseService.getInstance();
  const allConferences = await db.getConferences();

  if (allConferences.length === 0) {
    return { found: false };
  }

  // Try exact match first
  const exactMatch = allConferences.find(
    conf => conf.conference.toLowerCase() === conferenceName.toLowerCase()
  );

  if (exactMatch) {
    return { found: true, conference: exactMatch, similarity: 1.0 };
  }

  // Calculate similarity for all conferences
  const conferenceMatches = allConferences.map(conf => ({
    conference: conf,
    similarity: calculateSimilarity(conferenceName, conf.conference)
  }));

  // Sort by similarity (descending)
  conferenceMatches.sort((a, b) => b.similarity - a.similarity);

  // Get best match and check if it meets the threshold
  const bestMatch = conferenceMatches[0];

  if (bestMatch && bestMatch.similarity >= similarityThreshold) {
    return {
      found: true,
      conference: bestMatch.conference,
      similarity: bestMatch.similarity
    };
  }

  // Return top suggestions if no good match found
  const suggestions = conferenceMatches
    .slice(0, 3) // Get top 3 matches
    .map(match => match.conference);

  return {
    found: false,
    suggestions
  };
}
