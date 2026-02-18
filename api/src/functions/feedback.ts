/**
 * Azure Function: POST /api/feedback
 *
 * Proxies user feedback (bug reports and feature requests) to GitHub Issues.
 * Keeps the GitHub token server-side so it's never exposed to the browser.
 */

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { parseClientPrincipal } from '../shared/cosmos.js'

interface FeedbackPayload {
  type: 'bug' | 'feature'
  title: string
  description: string
  /** Optional: which page/era/pack the user was on */
  context?: string
  /** Optional: browser info */
  userAgent?: string
}

const GITHUB_REPO_OWNER = 'tdevere'
const GITHUB_REPO_NAME = 'parallax-atlas'

async function handleFeedback(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  // Authenticate
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  const submitter = principal?.userDetails ?? 'anonymous'

  const body = (await request.json()) as FeedbackPayload

  // Validate
  if (!body.type || !body.title || !body.description) {
    return { status: 400, jsonBody: { error: 'type, title, and description are required' } }
  }

  if (!['bug', 'feature'].includes(body.type)) {
    return { status: 400, jsonBody: { error: 'type must be "bug" or "feature"' } }
  }

  if (body.title.length > 200) {
    return { status: 400, jsonBody: { error: 'title must be 200 characters or fewer' } }
  }

  if (body.description.length > 5000) {
    return { status: 400, jsonBody: { error: 'description must be 5000 characters or fewer' } }
  }

  // Build the GitHub issue
  const label = body.type === 'bug' ? 'bug' : 'enhancement'
  const prefix = body.type === 'bug' ? '[Bug]' : '[Feature]'

  const issueBody = [
    `### ${body.type === 'bug' ? 'Bug Report' : 'Feature Request'}`,
    '',
    body.description,
    '',
    '---',
    `**Submitted by:** ${submitter}`,
    `**Source:** In-app feedback`,
    body.context ? `**App context:** ${body.context}` : '',
    body.userAgent ? `**User agent:** ${body.userAgent}` : '',
    `**Timestamp:** ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n')

  // Create GitHub issue via API
  const ghToken = process.env.GITHUB_FEEDBACK_TOKEN
  if (!ghToken) {
    return { status: 503, jsonBody: { error: 'Feedback service is not configured' } }
  }

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          title: `${prefix} ${body.title}`,
          body: issueBody,
          labels: [label, 'user-feedback'],
        }),
      },
    )

    if (!ghResponse.ok) {
      const err = await ghResponse.text()
      console.error('GitHub API error:', ghResponse.status, err)
      return { status: 502, jsonBody: { error: 'Failed to create issue on GitHub' } }
    }

    const created = (await ghResponse.json()) as { html_url: string; number: number }

    return {
      status: 201,
      jsonBody: {
        success: true,
        issueNumber: created.number,
        issueUrl: created.html_url,
      },
    }
  } catch (err) {
    console.error('GitHub API request failed:', err)
    return { status: 502, jsonBody: { error: 'Failed to reach GitHub' } }
  }
}

app.http('feedback', {
  methods: ['POST'],
  authLevel: 'anonymous', // SWA route rules enforce authenticated
  route: 'feedback',
  handler: handleFeedback,
})
