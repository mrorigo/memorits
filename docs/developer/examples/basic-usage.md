# Basic Usage Examples

This document provides practical examples of using Memorits in real-world applications, from simple memory operations to advanced AI agent implementations.

## 1. Simple Memory Application

```typescript
import { Memori, ConfigManager } from 'memorits';

class SimpleMemoryApp {
  private memori: Memori;

  constructor() {
    // Initialize with default configuration
    const config = ConfigManager.loadConfig();
    this.memori = new Memori(config);
  }

  async initialize() {
    await this.memori.enable();
    console.log('Memory system ready!');
  }

  async rememberSomething(content: string, category: string = 'general') {
    // Record information for later retrieval
    const chatId = await this.memori.recordConversation(
      `Remember: ${content}`,
      `I'll remember that ${content}`,
      'gpt-4o-mini'
    );

    console.log(`Recorded memory: ${chatId}`);
    return chatId;
  }

  async recallInformation(query: string) {
    // Search for relevant memories
    const memories = await this.memori.searchMemories(query, {
      limit: 5,
      minImportance: 'medium'
    });

    return memories.map(memory => memory.content);
  }

  async showMemoryStats() {
    // Get memory statistics
    const stats = await this.memori.getDatabaseStats();
    console.log('Memory Statistics:', {
      totalMemories: stats.totalMemories,
      shortTermMemories: stats.shortTermMemories,
      longTermMemories: stats.longTermMemories,
      databaseSize: stats.databaseSize
    });
  }
}

// Usage
const app = new SimpleMemoryApp();
await app.initialize();

await app.rememberSomething('TypeScript is a superset of JavaScript');
const memories = await app.recallInformation('TypeScript');
console.log('Recalled:', memories);
```

## 2. AI Chatbot with Memory

```typescript
import { createMemoriOpenAI } from 'memorits';

class MemoryEnabledChatbot {
  private client: any;
  private sessionId: string;

  constructor(apiKey: string) {
    // Create OpenAI client with automatic memory
    this.client = createMemoriOpenAI(apiKey, {
      enableChatMemory: true,
      autoInitialize: true,
      memoryProcessingMode: 'auto'
    });

    this.sessionId = this.generateSessionId();
  }

  async chat(userMessage: string) {
    try {
      // Get AI response with memory context
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant with memory capabilities. Use your memory to provide contextually relevant responses.'
          },
          { role: 'user', content: userMessage }
        ]
      });

      // Record the conversation for future context
      await this.client.memory.recordConversation(
        userMessage,
        response.choices[0].message.content,
        'gpt-4o-mini',
        { sessionId: this.sessionId }
      );

      return response.choices[0].message.content;

    } catch (error) {
      console.error('Chat error:', error);
      return 'Sorry, I encountered an error processing your message.';
    }
  }

  async searchChatHistory(query: string) {
    // Search through conversation history
    const memories = await this.client.memory.searchMemories(query, {
      limit: 10,
      includeMetadata: true
    });

    return memories.map(memory => ({
      content: memory.content,
      importance: memory.metadata.importanceScore,
      createdAt: memory.metadata.createdAt
    }));
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Usage
const chatbot = new MemoryEnabledChatbot(process.env.OPENAI_API_KEY!);

console.log(await chatbot.chat('My name is Alice and I love programming'));
console.log(await chatbot.chat('What is my name?'));

const history = await chatbot.searchChatHistory('Alice');
console.log('Chat history:', history);
```

## 3. Personal Knowledge Base

```typescript
import { Memori, MemoryClassification, MemoryImportanceLevel } from 'memorits';

class PersonalKnowledgeBase {
  private memori: Memori;

  constructor() {
    const config = ConfigManager.loadConfig();
    this.memori = new Memori(config);
  }

  async initialize() {
    await this.memori.enable();
  }

  async addKnowledge(
    topic: string,
    content: string,
    category: MemoryClassification = MemoryClassification.REFERENCE,
    importance: MemoryImportanceLevel = MemoryImportanceLevel.MEDIUM
  ) {
    // Add knowledge with specific classification
    const chatId = await this.memori.recordConversation(
      `Knowledge: ${topic}`,
      content,
      'manual-entry',
      {
        metadata: {
          topic: topic,
          category: category,
          importance: importance,
          source: 'manual_entry'
        }
      }
    );

    console.log(`Added knowledge: ${topic} (${chatId})`);
    return chatId;
  }

  async searchKnowledge(
    query: string,
    category?: MemoryClassification,
    minImportance: MemoryImportanceLevel = MemoryImportanceLevel.LOW
  ) {
    // Search knowledge base with filters
    const searchOptions: any = {
      limit: 20,
      minImportance: minImportance,
      includeMetadata: true
    };

    if (category) {
      searchOptions.categories = [category];
    }

    const results = await this.memori.searchMemories(query, searchOptions);

    return results.map(result => ({
      content: result.content,
      topic: result.metadata.topic,
      category: result.metadata.category,
      importance: result.metadata.importanceScore,
      confidence: result.metadata.confidenceScore,
      createdAt: result.metadata.createdAt
    }));
  }

  async getTopicsByCategory() {
    // Get all unique topics organized by category
    const allMemories = await this.memori.searchMemories('', {
      limit: 1000,
      includeMetadata: true
    });

    const topicsByCategory = allMemories.reduce((acc, memory) => {
      const category = memory.metadata.category;
      const topic = memory.metadata.topic;

      if (!acc[category]) {
        acc[category] = new Set();
      }
      if (topic) {
        acc[category].add(topic);
      }

      return acc;
    }, {} as Record<string, Set<string>>);

    // Convert Sets to Arrays for easier consumption
    const result: Record<string, string[]> = {};
    for (const [category, topics] of Object.entries(topicsByCategory)) {
      result[category] = Array.from(topics);
    }

    return result;
  }
}

// Usage
const knowledgeBase = new PersonalKnowledgeBase();
await knowledgeBase.initialize();

// Add some knowledge
await knowledgeBase.addKnowledge(
  'TypeScript',
  'TypeScript is a strongly typed programming language that builds on JavaScript',
  MemoryClassification.REFERENCE,
  MemoryImportanceLevel.HIGH
);

await knowledgeBase.addKnowledge(
  'React Hooks',
  'React Hooks let you use state and other React features in functional components',
  MemoryClassification.REFERENCE,
  MemoryImportanceLevel.HIGH
);

// Search knowledge
const tsKnowledge = await knowledgeBase.searchKnowledge('TypeScript');
console.log('TypeScript knowledge:', tsKnowledge);

// Get organized topics
const topics = await knowledgeBase.getTopicsByCategory();
console.log('Topics by category:', topics);
```

## 4. Task Reminder System

```typescript
import { Memori, MemoryClassification, MemoryImportanceLevel } from 'memorits';

class TaskReminderSystem {
  private memori: Memori;

  constructor() {
    const config = ConfigManager.loadConfig();
    this.memori = new Memori(config);
  }

  async initialize() {
    await this.memori.enable();
  }

  async addTask(
    task: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    dueDate?: Date
  ) {
    const importance = priority === 'high' ? MemoryImportanceLevel.HIGH :
                      priority === 'medium' ? MemoryImportanceLevel.MEDIUM :
                      MemoryImportanceLevel.LOW;

    const taskContent = dueDate
      ? `Task: ${task} (Due: ${dueDate.toISOString()})`
      : `Task: ${task}`;

    const chatId = await this.memori.recordConversation(
      taskContent,
      `I'll remind you about: ${task}`,
      'task-entry',
      {
        metadata: {
          type: 'task',
          priority: priority,
          dueDate: dueDate?.toISOString(),
          status: 'pending'
        }
      }
    );

    console.log(`Added task: ${task} (${chatId})`);
    return chatId;
  }

  async getTasksByPriority(priority?: 'low' | 'medium' | 'high') {
    const searchOptions: any = {
      categories: [MemoryClassification.CONVERSATIONAL],
      limit: 50,
      includeMetadata: true
    };

    if (priority) {
      searchOptions.metadataFilters = {
        fields: [
          {
            key: 'priority',
            value: priority,
            operator: 'eq'
          }
        ]
      };
    }

    const results = await this.memori.searchMemories('Task:', searchOptions);

    return results
      .filter(result => result.metadata.type === 'task')
      .map(result => ({
        id: result.id,
        task: result.content.replace('Task: ', ''),
        priority: result.metadata.priority,
        dueDate: result.metadata.dueDate ? new Date(result.metadata.dueDate) : null,
        status: result.metadata.status,
        createdAt: result.metadata.createdAt
      }));
  }

  async markTaskComplete(taskId: string) {
    // Update task status
    await this.memori.updateMemoryMetadata(taskId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    console.log(`Marked task ${taskId} as completed`);
  }

  async getOverdueTasks() {
    const allTasks = await this.getTasksByPriority();
    const now = new Date();

    return allTasks.filter(task =>
      task.dueDate &&
      task.dueDate < now &&
      task.status !== 'completed'
    );
  }
}

// Usage
const taskSystem = new TaskReminderSystem();
await taskSystem.initialize();

// Add tasks
await taskSystem.addTask('Review project proposal', 'high', new Date('2024-02-01'));
await taskSystem.addTask('Update documentation', 'medium', new Date('2024-02-15'));
await taskSystem.addTask('Plan team meeting', 'low');

// Get tasks by priority
const highPriorityTasks = await taskSystem.getTasksByPriority('high');
console.log('High priority tasks:', highPriorityTasks);

// Check for overdue tasks
const overdueTasks = await taskSystem.getOverdueTasks();
console.log('Overdue tasks:', overdueTasks);
```

## 5. Learning Progress Tracker

```typescript
import { Memori, MemoryClassification, MemoryImportanceLevel } from 'memorits';

class LearningProgressTracker {
  private memori: Memori;

  constructor() {
    const config = ConfigManager.loadConfig();
    this.memori = new Memori(config);
  }

  async initialize() {
    await this.memori.enable();
  }

  async logLearningSession(
    topic: string,
    content: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ) {
    const importance = difficulty === 'advanced' ? MemoryImportanceLevel.HIGH :
                      difficulty === 'intermediate' ? MemoryImportanceLevel.MEDIUM :
                      MemoryImportanceLevel.LOW;

    const sessionId = await this.memori.recordConversation(
      `Learning: ${topic}`,
      content,
      'learning-session',
      {
        metadata: {
          type: 'learning',
          topic: topic,
          difficulty: difficulty,
          sessionDate: new Date().toISOString()
        }
      }
    );

    console.log(`Logged learning session: ${topic}`);
    return sessionId;
  }

  async getLearningProgress(topic?: string) {
    // Get learning sessions with optional topic filter
    const searchOptions: any = {
      categories: [MemoryClassification.CONVERSATIONAL],
      limit: 100,
      includeMetadata: true
    };

    if (topic) {
      searchOptions.metadataFilters = {
        fields: [
          {
            key: 'topic',
            value: topic,
            operator: 'eq'
          }
        ]
      };
    }

    const results = await this.memori.searchMemories('Learning:', searchOptions);

    return results
      .filter(result => result.metadata.type === 'learning')
      .map(result => ({
        topic: result.metadata.topic,
        difficulty: result.metadata.difficulty,
        content: result.content,
        sessionDate: result.metadata.sessionDate,
        importance: result.metadata.importanceScore
      }));
  }

  async getTopicsByDifficulty() {
    const allLearning = await this.getLearningProgress();

    return allLearning.reduce((acc, session) => {
      const difficulty = session.difficulty;
      const topic = session.topic;

      if (!acc[difficulty]) {
        acc[difficulty] = new Set();
      }
      acc[difficulty].add(topic);

      return acc;
    }, {} as Record<string, Set<string>>);
  }

  async findWeakAreas() {
    // Find topics with low importance scores (indicating difficulty)
    const results = await this.memori.searchMemories('Learning:', {
      limit: 100,
      includeMetadata: true
    });

    const learningSessions = results.filter(r => r.metadata.type === 'learning');

    // Group by topic and calculate average importance
    const topicImportance = learningSessions.reduce((acc, session) => {
      const topic = session.metadata.topic;
      const importance = session.metadata.importanceScore;

      if (!acc[topic]) {
        acc[topic] = { total: 0, count: 0, sessions: [] };
      }

      acc[topic].total += importance;
      acc[topic].count += 1;
      acc[topic].sessions.push(session);

      return acc;
    }, {} as Record<string, { total: number; count: number; sessions: any[] }>);

    // Find topics with low average importance
    const weakAreas = Object.entries(topicImportance)
      .map(([topic, data]) => ({
        topic,
        averageImportance: data.total / data.count,
        sessionCount: data.count
      }))
      .filter(area => area.averageImportance < 0.6)
      .sort((a, b) => a.averageImportance - b.averageImportance);

    return weakAreas;
  }
}

// Usage
const learningTracker = new LearningProgressTracker();
await learningTracker.initialize();

// Log learning sessions
await learningTracker.logLearningSession(
  'React Hooks',
  'Learned about useState and useEffect for state management',
  'intermediate'
);

await learningTracker.logLearningSession(
  'Advanced TypeScript',
  'Generic constraints and conditional types are challenging',
  'advanced'
);

// Get learning progress
const reactProgress = await learningTracker.getLearningProgress('React Hooks');
console.log('React progress:', reactProgress);

// Find areas needing more attention
const weakAreas = await learningTracker.findWeakAreas();
console.log('Areas needing attention:', weakAreas);
```

## 6. Context-Aware AI Assistant

```typescript
import { createMemoriOpenAI } from 'memorits';

class ContextAwareAssistant {
  private client: any;
  private userProfile: any = {};

  constructor(apiKey: string) {
    this.client = createMemoriOpenAI(apiKey, {
      enableChatMemory: true,
      autoInitialize: true,
      memoryProcessingMode: 'conscious'
    });
  }

  async learnAboutUser(userInfo: string) {
    // Learn and remember user information
    await this.client.memory.recordConversation(
      `User info: ${userInfo}`,
      `I understand: ${userInfo}`,
      'user-learning'
    );

    // Update user profile
    this.userProfile = await this.buildUserProfile();
  }

  async buildUserProfile() {
    // Build user profile from memories
    const userMemories = await this.client.memory.searchMemories('user info', {
      categories: ['personal', 'conscious-info'],
      minImportance: 'medium',
      limit: 20
    });

    const profile = {
      interests: [],
      preferences: [],
      skills: [],
      background: []
    };

    userMemories.forEach(memory => {
      const content = memory.content.toLowerCase();

      if (content.includes('interest') || content.includes('like')) {
        profile.interests.push(memory.content);
      }
      if (content.includes('prefer') || content.includes('favorite')) {
        profile.preferences.push(memory.content);
      }
      if (content.includes('skill') || content.includes('experience')) {
        profile.skills.push(memory.content);
      }
      if (content.includes('background') || content.includes('work')) {
        profile.background.push(memory.content);
      }
    });

    return profile;
  }

  async answerQuestion(question: string) {
    // Get relevant context
    const context = await this.client.memory.searchMemories(question, {
      limit: 3,
      minImportance: 'medium'
    });

    // Build context-aware prompt
    const contextText = context.map(c => c.content).join('\n');
    const profileText = Object.entries(this.userProfile)
      .map(([key, values]) => `${key}: ${values.join(', ')}`)
      .join('\n');

    const prompt = `
User Profile:
${profileText}

Relevant Context:
${contextText}

Question: ${question}

Please provide a helpful, personalized response based on the user's profile and relevant context.
    `;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    });

    // Record this interaction
    await this.client.memory.recordConversation(
      question,
      response.choices[0].message.content,
      'gpt-4o-mini'
    );

    return response.choices[0].message.content;
  }

  async getPersonalizedRecommendations() {
    // Get recommendations based on user profile
    const recommendations = await this.client.memory.searchMemories(
      'recommendations suggestions',
      {
        categories: ['essential', 'contextual'],
        limit: 10
      }
    );

    return recommendations.map(rec => ({
      content: rec.content,
      relevance: rec.score,
      category: rec.metadata.category
    }));
  }
}

// Usage
const assistant = new ContextAwareAssistant(process.env.OPENAI_API_KEY!);

// Learn about user
await assistant.learnAboutUser('I am a software engineer who loves TypeScript and React');
await assistant.learnAboutUser('I prefer dark mode and concise code examples');
await assistant.learnAboutUser('I have 5 years of experience in web development');

// Ask personalized questions
console.log(await assistant.answerQuestion('What should I learn next for career growth?'));
console.log(await assistant.answerQuestion('Can you show me a TypeScript example?'));

// Get personalized recommendations
const recommendations = await assistant.getPersonalizedRecommendations();
console.log('Personalized recommendations:', recommendations);
```

These examples demonstrate how Memorits can be used to build sophisticated, memory-enabled applications ranging from simple note-taking systems to advanced AI assistants with persistent context and learning capabilities.