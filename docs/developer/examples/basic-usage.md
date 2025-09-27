# Basic Usage Examples

This guide provides practical examples of using Memorits in common AI agent scenarios. These examples demonstrate how to leverage Memorits' powerful memory capabilities to build more context-aware and intelligent applications.

## 1. Simple Chat Assistant with Memory

The most basic use case - a chat assistant that remembers conversations:

```typescript
import { Memori, ConfigManager, createMemoriOpenAI } from 'memorits';

class ChatAssistant {
  private memori: Memori;
  private openaiClient: any;

  constructor() {
    // Initialize with default configuration
    this.memori = new Memori();
    this.openaiClient = createMemoriOpenAI(
      this.memori,
      process.env.OPENAI_API_KEY!
    );
  }

  async initialize() {
    await this.memori.enable();
    console.log('🤖 Chat assistant with memory ready!');
  }

  async chat(message: string): Promise<string> {
    try {
      // Record the conversation (automatic with MemoriOpenAI)
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant with perfect memory. Use your memory to provide contextually relevant responses.'
          },
          { role: 'user', content: message }
        ],
        max_tokens: 500
      });

      const reply = response.choices[0].message.content;

      // The conversation is automatically recorded by MemoriOpenAI
      console.log(`💬 Conversation recorded with ${reply.length} characters`);

      return reply;
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  async searchMemory(query: string) {
    const memories = await this.memori.searchMemories(query, {
      limit: 5,
      includeMetadata: true
    });

    return memories.map(memory => ({
      content: memory.content,
      relevance: memory.confidenceScore,
      when: memory.metadata?.extractionTimestamp
    }));
  }

  async close() {
    await this.memori.close();
  }
}

// Usage example
const assistant = new ChatAssistant();
await assistant.initialize();

// Have a conversation
await assistant.chat("Remember that I prefer dark mode in all applications.");
await assistant.chat("What are my UI preferences?");

// Search for preferences
const preferences = await assistant.searchMemory('preferences');
console.log('Found preferences:', preferences);

await assistant.close();
```

## 2. Project Management Assistant

A more sophisticated example that tracks project context and decisions:

```typescript
import { Memori, MemoryClassification, MemoryImportanceLevel } from 'memorits';

class ProjectManager {
  private memori: Memori;
  private currentProject: string;

  constructor(projectName: string) {
    this.currentProject = projectName;
    this.memori = new Memori({
      namespace: `project_${projectName}`,
      autoIngest: true,
      minImportanceLevel: 'medium'
    });
  }

  async initialize() {
    await this.memori.enable();
    console.log(`📋 Project manager for "${this.currentProject}" initialized`);
  }

  async recordDecision(decision: string, context: string, importance: MemoryImportanceLevel = 'high') {
    // Record important project decision
    const chatId = await this.memori.recordConversation(
      `Project Decision: ${decision}`,
      `Context: ${context}`,
      {
        metadata: {
          type: 'decision',
          importance,
          project: this.currentProject,
          timestamp: new Date().toISOString()
        }
      }
    );

    console.log(`✅ Decision recorded: ${chatId}`);
    return chatId;
  }

  async recordTask(task: string, assignee: string, priority: string = 'medium') {
    const chatId = await this.memori.recordConversation(
      `New Task: ${task}`,
      `Assigned to: ${assignee}, Priority: ${priority}`,
      {
        metadata: {
          type: 'task',
          priority,
          assignee,
          project: this.currentProject,
          status: 'pending'
        }
      }
    );

    return chatId;
  }

  async getProjectContext(query?: string) {
    const searchQuery = query || 'project decisions OR tasks OR requirements';

    const memories = await this.memori.searchMemories(searchQuery, {
      categories: ['essential', 'contextual'],
      minImportance: 'medium',
      limit: 20,
      includeMetadata: true
    });

    // Group by type
    const decisions = memories.filter(m => m.metadata?.type === 'decision');
    const tasks = memories.filter(m => m.metadata?.type === 'task');

    return {
      decisions: decisions.map(m => ({
        content: m.content,
        importance: m.importance,
        when: m.metadata?.timestamp
      })),
      tasks: tasks.map(m => ({
        content: m.content,
        assignee: m.metadata?.assignee,
        priority: m.metadata?.priority,
        status: m.metadata?.status
      })),
      totalMemories: memories.length
    };
  }

  async getRecentActivity(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Use temporal filtering for recent activity
    const recentMemories = await this.memori.searchMemories('project activity', {
      includeMetadata: true,
      limit: 10
    });

    return recentMemories
      .filter(m => new Date(m.metadata?.timestamp || 0) > since)
      .map(m => ({
        content: m.content,
        type: m.metadata?.type,
        timestamp: m.metadata?.timestamp
      }));
  }

  async generateProjectSummary() {
    const context = await this.getProjectContext();

    const summary = `
Project Summary: ${this.currentProject}
========================================

Decisions Made: ${context.decisions.length}
- Recent: ${context.decisions.slice(0, 3).map(d => d.content).join(', ')}

Active Tasks: ${context.tasks.filter(t => t.status === 'pending').length}
- High Priority: ${context.tasks.filter(t => t.priority === 'high').length}

Total Context Items: ${context.totalMemories}
Recent Activity (24h): ${context.recentActivity?.length || 0} items
    `.trim();

    return summary;
  }

  async close() {
    await this.memori.close();
  }
}

// Usage example
const projectManager = new ProjectManager('AI-Assistant-Platform');
await projectManager.initialize();

// Record project activities
await projectManager.recordDecision(
  'Use TypeScript for type safety',
  'All team members agreed on TypeScript for better development experience',
  'high'
);

await projectManager.recordTask(
  'Implement user authentication',
  'alice',
  'high'
);

await projectManager.recordTask(
  'Design database schema',
  'bob',
  'medium'
);

// Get project context
const context = await projectManager.getProjectContext();
console.log('Project context:', context);

// Generate summary
const summary = await projectManager.generateProjectSummary();
console.log(summary);

await projectManager.close();
```

## 3. Research Assistant

An example showing how to build a research assistant that accumulates knowledge:

```typescript
import { Memori, SearchStrategy } from 'memorits';

class ResearchAssistant {
  private memori: Memori;
  private researchTopics: Set<string> = new Set();

  constructor() {
    this.memori = new Memori({
      namespace: 'research_assistant',
      autoIngest: true,
      consciousIngest: false
    });
  }

  async initialize() {
    await this.memori.enable();
    console.log('🔬 Research assistant initialized');
  }

  async addResearch(topic: string, content: string, source: string) {
    // Record research finding
    const chatId = await this.memori.recordConversation(
      `Research on: ${topic}`,
      `Source: ${source}\n\n${content}`,
      {
        metadata: {
          type: 'research',
          topic,
          source,
          researchDate: new Date().toISOString()
        }
      }
    );

    this.researchTopics.add(topic);
    console.log(`📚 Research added for topic: ${topic}`);
    return chatId;
  }

  async queryResearch(topic: string, useAdvancedSearch: boolean = false) {
    if (useAdvancedSearch) {
      // Use FTS5 strategy for precise search
      return await this.memori.searchMemoriesWithStrategy(
        topic,
        SearchStrategy.FTS5,
        {
          categories: ['essential', 'reference'],
          minImportance: 'medium',
          limit: 15,
          includeMetadata: true
        }
      );
    } else {
      // Use standard search
      return await this.memori.searchMemories(topic, {
        categories: ['essential', 'reference'],
        minImportance: 'medium',
        limit: 10
      });
    }
  }

  async findRelatedTopics(topic: string) {
    // Search for related concepts
    const memories = await this.memori.searchMemories(topic, {
      limit: 20,
      includeMetadata: true
    });

    // Extract topics from results
    const relatedTopics = new Set<string>();
    memories.forEach(memory => {
      if (memory.metadata?.topic) {
        relatedTopics.add(memory.metadata.topic);
      }
    });

    return Array.from(relatedTopics);
  }

  async generateResearchReport(topic: string) {
    const researchData = await this.queryResearch(topic, true);
    const relatedTopics = await this.findRelatedTopics(topic);

    const report = {
      topic,
      totalFindings: researchData.length,
      relatedTopics,
      keyFindings: researchData.slice(0, 5).map(m => ({
        content: m.summary,
        relevance: m.confidenceScore,
        source: m.metadata?.source,
        date: m.metadata?.researchDate
      })),
      lastUpdated: new Date().toISOString(),
      confidence: researchData.length > 0 ?
        researchData.reduce((sum, m) => sum + m.confidenceScore, 0) / researchData.length : 0
    };

    return report;
  }

  async getResearchStats() {
    const allTopics = Array.from(this.researchTopics);
    const stats = {
      totalTopics: allTopics.length,
      topics: await Promise.all(allTopics.map(async (topic) => {
        const findings = await this.queryResearch(topic);
        return {
          topic,
          findingCount: findings.length,
          avgConfidence: findings.length > 0 ?
            findings.reduce((sum, f) => sum + f.confidenceScore, 0) / findings.length : 0
        };
      }))
    };

    return stats;
  }

  async close() {
    await this.memori.close();
  }
}

// Usage example
const researcher = new ResearchAssistant();
await researcher.initialize();

// Add research data
await researcher.addResearch(
  'machine learning',
  'Neural networks are computing systems inspired by biological neural networks...',
  'Wikipedia'
);

await researcher.addResearch(
  'artificial intelligence',
  'AI refers to the simulation of human intelligence in machines...',
  'TechCrunch Article'
);

await researcher.addResearch(
  'deep learning',
  'Deep learning is a subset of machine learning based on artificial neural networks...',
  'Research Paper'
);

// Query research
const mlResearch = await researcher.queryResearch('machine learning');
console.log(`Found ${mlResearch.length} findings about machine learning`);

// Find related topics
const related = await researcher.findRelatedTopics('machine learning');
console.log('Related topics:', related);

// Generate report
const report = await researcher.generateResearchReport('machine learning');
console.log('Research report:', JSON.stringify(report, null, 2));

// Get statistics
const stats = await researcher.getResearchStats();
console.log('Research stats:', stats);

await researcher.close();
```

## 4. Customer Support Agent

Example showing how to maintain conversation context and user preferences:

```typescript
import { Memori, MemoryClassification, MemoryImportanceLevel } from 'memorits';

class SupportAgent {
  private memori: Memori;
  private userProfiles: Map<string, any> = new Map();

  constructor() {
    this.memori = new Memori({
      namespace: 'customer_support',
      autoIngest: true
    });
  }

  async initialize() {
    await this.memori.enable();
    console.log('🎧 Customer support agent ready');
  }

  async startSupportSession(userId: string) {
    // Load or create user profile
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = await this.loadUserProfile(userId);
      this.userProfiles.set(userId, profile);
    }

    console.log(`👤 Support session started for user: ${userId}`);
    return profile;
  }

  async recordIssue(userId: string, issue: string, category: string) {
    const chatId = await this.memori.recordConversation(
      `User ${userId} reported: ${issue}`,
      `Category: ${category}`,
      {
        metadata: {
          type: 'support_issue',
          userId,
          category,
          status: 'open',
          priority: 'medium',
          reportedAt: new Date().toISOString()
        }
      }
    );

    // Update user profile
    const profile = this.userProfiles.get(userId) || {};
    if (!profile.issues) profile.issues = [];
    profile.issues.push({ issue, category, chatId, date: new Date() });
    this.userProfiles.set(userId, profile);

    return chatId;
  }

  async updateUserPreference(userId: string, preference: string, value: string) {
    await this.memori.recordConversation(
      `User ${userId} preference: ${preference}`,
      `Value: ${value}`,
      {
        metadata: {
          type: 'user_preference',
          userId,
          preference,
          value,
          updatedAt: new Date().toISOString()
        }
      }
    );

    // Update local profile
    const profile = this.userProfiles.get(userId) || {};
    if (!profile.preferences) profile.preferences = {};
    profile.preferences[preference] = value;
    this.userProfiles.set(userId, profile);
  }

  async getUserContext(userId: string) {
    const userMemories = await this.memori.searchMemories(`user:${userId}`, {
      categories: ['personal', 'essential'],
      limit: 20,
      includeMetadata: true
    });

    const issues = userMemories.filter(m => m.metadata?.type === 'support_issue');
    const preferences = userMemories.filter(m => m.metadata?.type === 'user_preference');

    return {
      userId,
      totalInteractions: userMemories.length,
      openIssues: issues.filter(i => i.metadata?.status === 'open').length,
      preferences: preferences.reduce((acc, p) => {
        acc[p.metadata?.preference] = p.metadata?.value;
        return acc;
      }, {} as Record<string, string>),
      recentActivity: userMemories.slice(0, 5).map(m => ({
        content: m.summary,
        type: m.metadata?.type,
        date: m.metadata?.reportedAt || m.metadata?.updatedAt
      }))
    };
  }

  async resolveIssue(userId: string, issueId: string, resolution: string) {
    // Find the issue memory
    const issues = await this.memori.searchMemories(`issue:${issueId}`, {
      includeMetadata: true
    });

    if (issues.length > 0) {
      // Record resolution
      await this.memori.recordConversation(
        `Issue ${issueId} resolved`,
        `Resolution: ${resolution}`,
        {
          metadata: {
            type: 'issue_resolution',
            userId,
            issueId,
            resolution,
            resolvedAt: new Date().toISOString()
          }
        }
      );

      console.log(`✅ Issue ${issueId} resolved for user ${userId}`);
    }
  }

  async generateSupportSummary(userId: string) {
    const context = await this.getUserContext(userId);
    const profile = this.userProfiles.get(userId);

    return {
      userId,
      profile: profile || {},
      context,
      summary: `
Support Summary for ${userId}
============================

Total Interactions: ${context.totalInteractions}
Open Issues: ${context.openIssues}
User Preferences: ${Object.keys(context.preferences).length}

Recent Activity:
${context.recentActivity.map(a => `- ${a.type}: ${a.content}`).join('\n')}

Profile Data:
${Object.entries(profile || {}).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')}
      `.trim()
    };
  }

  private async loadUserProfile(userId: string) {
    const userMemories = await this.memori.searchMemories(`user:${userId}`, {
      categories: ['personal'],
      limit: 50
    });

    const profile: any = {
      userId,
      firstSeen: userMemories[userMemories.length - 1]?.metadata?.timestamp,
      lastSeen: userMemories[0]?.metadata?.timestamp,
      totalInteractions: userMemories.length
    };

    // Extract preferences and issues
    const preferences = userMemories.filter(m => m.metadata?.type === 'user_preference');
    const issues = userMemories.filter(m => m.metadata?.type === 'support_issue');

    if (preferences.length > 0) {
      profile.preferences = {};
      preferences.forEach(p => {
        if (p.metadata?.preference && p.metadata?.value) {
          profile.preferences[p.metadata.preference] = p.metadata.value;
        }
      });
    }

    if (issues.length > 0) {
      profile.issues = issues.map(i => ({
        id: i.metadata?.issueId,
        description: i.summary,
        status: i.metadata?.status,
        priority: i.metadata?.priority
      }));
    }

    return profile;
  }

  async close() {
    await this.memori.close();
  }
}

// Usage example
const supportAgent = new SupportAgent();
await supportAgent.initialize();

// Start support session
await supportAgent.startSupportSession('user123');

// Record user preferences
await supportAgent.updateUserPreference('user123', 'language', 'en');
await supportAgent.updateUserPreference('user123', 'theme', 'dark');

// Record support issues
await supportAgent.recordIssue('user123', 'Login not working', 'authentication');
await supportAgent.recordIssue('user123', 'Feature request', 'enhancement');

// Get user context
const context = await supportAgent.getUserContext('user123');
console.log('User context:', context);

// Generate support summary
const summary = await supportAgent.generateSupportSummary('user123');
console.log('Support summary:', summary);

await supportAgent.close();
```

## 5. Advanced Search Examples

Demonstrating sophisticated search capabilities:

```typescript
class AdvancedSearchExamples {
  private memori: Memori;

  constructor() {
    this.memori = new Memori({
      namespace: 'search_examples'
    });
  }

  async initialize() {
    await this.memori.enable();

    // Add sample data for searching
    await this.addSampleData();
  }

  private async addSampleData() {
    const sampleConversations = [
      {
        user: "What's the deadline for the project?",
        ai: "The project deadline is March 15th, 2024. This is a critical milestone.",
        metadata: { priority: 'high', type: 'deadline' }
      },
      {
        user: "How do I implement authentication?",
        ai: "For authentication, I recommend using JWT tokens with secure storage...",
        metadata: { priority: 'medium', type: 'technical' }
      },
      {
        user: "Remember my coffee preference",
        ai: "Noted: You prefer black coffee, no sugar, with meetings after 2pm.",
        metadata: { priority: 'low', type: 'personal' }
      }
    ];

    for (const conv of sampleConversations) {
      await this.memori.recordConversation(conv.user, conv.ai, {
        metadata: conv.metadata
      });
    }
  }

  async demonstrateBasicSearch() {
    console.log('🔍 Basic Search Examples');

    const urgentResults = await this.memori.searchMemories('urgent OR critical OR deadline', {
      minImportance: 'high',
      limit: 5
    });

    console.log('Urgent items:', urgentResults.map(r => r.summary));
  }

  async demonstrateAdvancedSearch() {
    console.log('🔍 Advanced Search Examples');

    // Multi-strategy search
    const technicalResults = await this.memori.searchMemories('authentication OR security', {
      categories: ['essential', 'reference'],
      includeMetadata: true
    });

    console.log('Technical results:', technicalResults.length);

    // Recent memories
    const recentMemories = await this.memori.searchRecentMemories(3, true);
    console.log('Recent memories:', recentMemories.map(r => ({
      content: r.summary,
      when: r.metadata?.extractionTimestamp
    })));
  }

  async demonstrateTemporalSearch() {
    console.log('🔍 Temporal Search Examples');

    // This would require temporal filtering strategy
    // const todayMemories = await this.memori.searchMemories('important', {
    //   temporalFilters: {
    //     relativeExpressions: ['today']
    //   }
    // });

    const allMemories = await this.memori.searchMemories('project OR technical OR personal', {
      includeMetadata: true
    });

    console.log('All memories with metadata:', allMemories.map(m => ({
      content: m.summary,
      type: m.metadata?.type,
      priority: m.metadata?.priority
    })));
  }

  async demonstrateContextAwareSearch() {
    console.log('🔍 Context-Aware Search');

    // Search with context
    const contextResults = await this.memori.searchMemories('preferences OR settings', {
      categories: ['personal'],
      limit: 10
    });

    console.log('Personal preferences:', contextResults);
  }

  async close() {
    await this.memori.close();
  }
}

// Usage
const searchExamples = new AdvancedSearchExamples();
await searchExamples.initialize();

await searchExamples.demonstrateBasicSearch();
await searchExamples.demonstrateAdvancedSearch();
await searchExamples.demonstrateTemporalSearch();
await searchExamples.demonstrateContextAwareSearch();

await searchExamples.close();
```

## Best Practices from Examples

### 1. Proper Initialization
- Always call `await memori.enable()` before using memory features
- Configure appropriate namespaces for different contexts
- Set reasonable importance levels and limits

### 2. Error Handling
- Wrap memory operations in try-catch blocks
- Handle both memory-specific and general errors
- Provide fallback behavior when memory operations fail

### 3. Metadata Usage
- Use metadata to add context and categorization
- Include timestamps, user IDs, and relevant identifiers
- Leverage metadata for advanced filtering

### 4. Resource Management
- Always call `await memori.close()` when done
- Use appropriate namespaces to avoid conflicts
- Monitor memory usage and clean up when necessary

### 5. Search Optimization
- Use specific search terms rather than broad queries
- Leverage categories and importance levels for filtering
- Include metadata in results when detailed information is needed

These examples demonstrate how Memorits can be used to build increasingly sophisticated AI agents that maintain context, learn from interactions, and provide more relevant responses over time.