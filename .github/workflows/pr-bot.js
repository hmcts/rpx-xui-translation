const https = require('https');
const fs = require('fs');

const CONFIG = {
  REQUIRED_APPROVALS: 2,
  TITLE_MAX_LENGTH: 60,
  SLACK_API_BASE: 'slack.com',
  GITHUB_API_BASE: 'api.github.com',
  UTILS_REPO_OWNER: 'hmcts',
  UTILS_REPO_NAME: 'rpx-xui-dev-utils',
  UTILS_STATE_FILE_PATH: 'prBot/state.json'
};

const ENV = {
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackChannel: process.env.SLACK_CHANNEL,
  slackChannelId: process.env.SLACK_CHANNEL_ID,
  githubToken: process.env.GITHUB_TOKEN,
  githubEventPath: process.env.GITHUB_EVENT_PATH,
  utilsRepoToken: process.env.UTILS_REPO_TOKEN
};

function validateEnvironment() {
  const required = ['slackBotToken', 'slackChannel', 'slackChannelId', 'githubToken', 'utilsRepoToken'];
  const missing = required.filter(key => !ENV[key]);
  
  if (missing.length > 0) {
    console.error(`Missing required env variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function loadEventData() {
  try {
    const data = JSON.parse(fs.readFileSync(ENV.githubEventPath, 'utf8'));
    return {
      action: data.action,
      prNumber: data.pull_request?.number,
      prAuthor: data.pull_request?.user?.login,
      prTitle: data.pull_request?.title,
      repo: data.repository?.full_name,
      reviewState: data.review?.state || ''
    };
  } catch (error) {
    console.error('Failed to parse GitHub event:', error.message);
    process.exit(1);
  }
}

async function httpRequest(hostname, path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path, method, headers };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(data ? JSON.parse(data || '{}') : {});
      });
    });
    
    req.on('error', error => reject(error));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const github = {
  async getReviews(repo, prNumber) {
    const path = `/repos/${repo}/pulls/${prNumber}/reviews`;
    const headers = {
      'Authorization': `Bearer ${ENV.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Node.js'
    };
    
    const reviews = await httpRequest(CONFIG.GITHUB_API_BASE, path, 'GET', headers);
    return reviews.filter(review => review.state === 'APPROVED').length;
  },

  // async getComments(repo, prNumber) {
  //   const path = `/repos/${repo}/issues/${prNumber}/comments`;
  //   const headers = {
  //     'Authorization': `Bearer ${ENV.githubToken}`,
  //     'Accept': 'application/vnd.github.v3+json',
  //     'User-Agent': 'Node.js'
  //   };
    
  //   return await httpRequest(CONFIG.GITHUB_API_BASE, path, 'GET', headers);
  // },

  // async postComment(repo, prNumber, body) {
  //   const path = `/repos/${repo}/issues/${prNumber}/comments`;
  //   const headers = {
  //     'Authorization': `Bearer ${ENV.githubToken}`,
  //     'Accept': 'application/vnd.github.v3+json',
  //     'User-Agent': 'Node.js'
  //   };
    
  //   return await httpRequest(CONFIG.GITHUB_API_BASE, path, 'POST', headers, { body });
  // },

  // async getSlackMessageTimestamp(repo, prNumber) {
  //   const comments = await github.getComments(repo, prNumber);
    
  //   if (!Array.isArray(comments)) {
  //     throw new Error(`GitHub API returned ${typeof comments}, expected array. Response: ${JSON.stringify(comments)}`);
  //   }
    
  //   const tsComment = comments.find(comment => comment.body.startsWith(CONFIG.TS_COMMENT_PREFIX));
  //   return tsComment ? { ts: tsComment.body.split(':')[1], commentId: tsComment.id } : null;
  // },

  // async deleteComment(repo, commentId) {
  //   const path = `/repos/${repo}/issues/comments/${commentId}`;
  //   const headers = {
  //     'Authorization': `Bearer ${ENV.githubToken}`,
  //     'Accept': 'application/vnd.github.v3+json',
  //     'User-Agent': 'Node.js'
  //   };
    
  //   return await httpRequest(CONFIG.GITHUB_API_BASE, path, 'DELETE', headers);
  // }
};

const slack = {
  async postMessage(channel, text) {
    const headers = {
      'Authorization': `Bearer ${ENV.slackBotToken}`,
      'Content-Type': 'application/json'
    };
    
    const response = await httpRequest(
      CONFIG.SLACK_API_BASE,
      '/api/chat.postMessage',
      'POST',
      headers,
      { channel, text }
    );
        
    if (!response.ok) {
      throw new Error(`Slack API error: ${response.error}`);
    }
    
    return response.ts;
  },

  async updateMessage(channel, ts, text) {
    const headers = {
      'Authorization': `Bearer ${ENV.slackBotToken}`,
      'Content-Type': 'application/json'
    };
    
    const response = await httpRequest(
      CONFIG.SLACK_API_BASE,
      '/api/chat.update',
      'POST',
      headers,
      { channel, ts, text }
    );
    
    if (!response.ok) {
      throw new Error(`Slack API error: ${response.error}`);
    }
  },

  async deleteMessage(channel, ts) {
    const headers = {
      'Authorization': `Bearer ${ENV.slackBotToken}`,
      'Content-Type': 'application/json'
    };
    
    const response = await httpRequest(
      CONFIG.SLACK_API_BASE,
      '/api/chat.delete',
      'POST',
      headers,
      { channel, ts }
    );
    
    if (!response.ok) {
      throw new Error(`Slack API error: ${response.error}`);
    }
  }
};

const stateManager = {
  async readState() {
    try {
      const path = `/repos/${CONFIG.UTILS_REPO_OWNER}/${CONFIG.UTILS_REPO_NAME}/contents/${CONFIG.UTILS_STATE_FILE_PATH}`;
      const headers = {
        'Authorization': `Bearer ${ENV.utilsRepoToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Node.js'
      }

      const response = await httpRequest(CONFIG.GITHUB_API_BASE, path, 'GET', headers);

      if (response.content) {
        const content = Buffer.from(response.content, 'base64').toString();
        return JSON.parse(content);
      } else {
        return { 
          metadata : {
            lastUpdates: new Date().toISOString(),
            approvalListMessageTs: null
          },
          repositories: {}
        };
      }
    } catch (error) {
      throw new Error(`Failed to read state: ${error.message}`);
    }
  },
  
  async writeState(state) {
    const path = `/repos/${CONFIG.UTILS_REPO_OWNER}/${CONFIG.UTILS_REPO_NAME}/contents/${CONFIG.UTILS_STATE_FILE_PATH}`;
    const headers = {
      'Authorization': `Bearer ${ENV.utilsRepoToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Node.js'
    }

    let sha = null;
    try {
      const currentFile = await httpRequest(CONFIG.GITHUB_API_BASE, path, 'GET', headers);
      sha = currentFile.sha;
    } catch (error) {
      // continue if file does not exist
    }

    const content = Buffer.from(JSON.stringify(state, null, 2)).toString('base64');
    const body = {
      message: `Update PR state from ${loadEventData().repo}`,
      content,
      branch: 'main'
    }

    if (sha) {
      body.sha = sha;
    }

    await httpRequest(CONFIG.GITHUB_API_BASE, path, 'PUT', headers, body);
  },

  async updatePR(repo, prNumber, updates) {
    const state = await this.readState();
  
    if (!state.repositories[repo]) {
      state.repositories[repo] = { pullRequests: {} };
    }

    state.repositories[repo].pullRequests[prNumber] = {
      ...state.repositories[repo].pullRequests[prNumber],
      ...updates,
      lastUpdated: new Date().toISOString()
    };

    state.metadata.lastUpdated = new Date().toISOString();

    await this.writeState(state);
    return state;
  },

  async removePR(repo, prNumber) {
    const state = await this.readState();
  
    if (state.repositories[repo]?.pullRequests[prNumber]) {
      delete state.repositories[repo].pullRequests[prNumber];

      if (Object.keys(state.repositories[repo].pullRequests).length === 0) {
        delete state.repositories[repo];
      }

      state.metadata.lastUpdated = new Date().toISOString();
      await this.writeState(state);
    }
  },

  async updateMetadata(updates) {
    const state = await this.readState();
    state.metadata = {
      ...state.metadata,
      ...updates
    };
    await this.writeState(state);
  }
}

async function repostApprovalList() {
  const state = await stateManager.readState();

  const needsApproval = [];
  
  Object.entries(state.repositories).forEach(([repo, data]) => {
    Object.values(data.pullRequests).forEach(pr => {
      if (pr.status === 'needs_Approval' || pr.changesRequested) {
        needsApproval.push({
          ...pr,
          repository: repo
        });
      }
    });
  });

  needsApproval.sort((a, b) => {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  let message = '';

  needsApproval.forEach(pr => {
    const emoji = pr.changesRequested ? '🔧 ' : '';
    message += formatPRMessage(pr.number, pr.author, pr.title, pr.repository, pr.approvals, emoji) + '\n\n';
  });

  // delete previous approval list message if it exists to maintain single message at head position
  if (state.metadata.approvalListMessageTs) {
    try {
      await slack.deleteMessage(ENV.slackChannelId, state.metadata.approvalListMessageTs);
    } catch (error) {
      // if message doesn't exist, we can ignore the error
    }
  }

  const ts = await slack.postMessage(ENV.slackChannelId, message);
  await stateManager.updateMetadata({ approvalListMessageTs: ts });
}

function formatPRMessage(prNumber, prAuthor, prTitle, repo, approvalCount, emoji = '') {
  const truncatedTitle = prTitle.length > CONFIG.TITLE_MAX_LENGTH 
    ? prTitle.slice(0, CONFIG.TITLE_MAX_LENGTH) + '…' 
    : prTitle;
  const prLink = `https://github.com/${repo}/pull/${prNumber}`;
  
  return `(${approvalCount} of ${CONFIG.REQUIRED_APPROVALS} approvals) PR #${prNumber} by ${prAuthor}:\n${emoji}<${prLink}|${truncatedTitle}>`;
}

async function handlePROpened(event) {
  const { prNumber, prAuthor, prTitle, repo } = event;
  const approvalCount = await github.getReviews(repo, prNumber);
  // const message = formatPRMessage(prNumber, prAuthor, prTitle, repo, approvalCount);

  // const messageTs = await slack.postMessage(ENV.slackChannel, message);
  
  // await github.postComment(repo, prNumber, `${CONFIG.TS_COMMENT_PREFIX}${messageTs}`);

  await stateManager.updatePR(repo, prNumber, {
    number: prNumber,
    title: prTitle,
    author: prAuthor,
    url: `https://github.com/${repo}/pull/${prNumber}`,
    status: 'needs_approval',
    approvals: approvalCount,
    createdAt: new Date().toISOString(),
  })

  await repostApprovalList();
}

async function handlePRReview(event) {
  const { prNumber, prAuthor, prTitle, repo, reviewState } = event;

  if (reviewState === 'changes_requested') {
    await handlePRChangesRequested(event);
    return;
  }

  if (reviewState !== 'approved') {
    return;
  }
  
  const approvalCount = await github.getReviews(repo, prNumber);
  
  // const timestampData = await github.getSlackMessageTimestamp(repo, prNumber);
  
  // if (!timestampData) {
  //   return;
  // }
  
  // if (approvalCount < CONFIG.REQUIRED_APPROVALS) {
  //   const message = formatPRMessage(prNumber, prAuthor, prTitle, repo, approvalCount);
  //   await slack.updateMessage(ENV.slackChannelId, timestampData.ts, message);
  // } else {
  //   await slack.deleteMessage(ENV.slackChannelId, timestampData.ts);
  // }
  if (approvalCount >= CONFIG.REQUIRED_APPROVALS) {
    // check if pr has changes requested
    const state = await stateManager.readState();
    const prData = state.repositories[repo]?.pullRequests[prNumber];

    if (!prData?.changesRequested) {
      // post standalone approval message
      const message = formatPRMessage(prNumber, prAuthor, prTitle, repo, approvalCount, '✅✅ ');
      await slack.postMessage(ENV.slackChannelId, message);

      // remove from state
      await stateManager.removePR(repo, prNumber)
    }
    else {
      await stateManager.updatePR(repo, prNumber, {
        approvals: approvalCount,
      })
    }
  }

  await repostApprovalList();
}

async function handlePRChangesRequested(event) {
  // const { prNumber, prAuthor, prTitle, repo, reviewState } = event;
  const { prNumber, repo, reviewState } = event;

  if (reviewState !== 'changes_requested') {
    return;
  }

  // const approvalCount = await github.getReviews(repo, prNumber);
  // const timestampData = await github.getSlackMessageTimestamp(repo, prNumber);

  // if (!timestampData) {
  //   return;
  // }

  // const message = formatPRMessage(prNumber, prAuthor, prTitle, repo, approvalCount, '🔧 ');
  // await slack.updateMessage(ENV.slackChannelId, timestampData.ts, message);

  await stateManager.updatePR(repo, prNumber, {
    changesRequested: true,
  });

  await repostApprovalList();
}

async function handlePRClosed(event) {
  const { prNumber, repo } = event;
  
  // const timestampData = await github.getSlackMessageTimestamp(repo, prNumber);
  
  // if (!timestampData) {
  //   return;
  // }
  
  // await slack.deleteMessage(ENV.slackChannelId, timestampData.ts);
  
  // await github.deleteComment(repo, timestampData.commentId);

  await stateManager.removePR(repo, prNumber);

  await repostApprovalList();
}

async function main() {
  validateEnvironment();
  const event = loadEventData();
  
  if (!event.prNumber || !event.repo) {
    console.error('Error with PR data');
    return;
  }
  
  try {
    switch (event.action) {
      case 'opened':
      case 'reopened':
        await handlePROpened(event);
        break;
      case 'submitted':
        await handlePRReview(event);
        break;
      case 'closed':
        await handlePRClosed(event);
        break;
      default:
        console.log(`No workflow required for event: ${event.action}`);
    }
  } catch (error) {
    console.error(`Error processing ${event.action} event:`, error.message);
    process.exit(1);
  }
}

main();