# Basic Usage Examples

This document provides practical examples of using Memorits in real-world applications, from simple memory operations to advanced AI agent implementations.

## 1. Simple Memory Application

```typescript
import { MemoriAI } from 'memorits';

class SimpleMemoryApp {
  private ai: MemoriAI;

  constructor() {
    // Initialize with simple configuration
    this.ai = new MemoriAI({
      databaseUrl: 'file:./memori.db',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4',
      provider: 'openai',
      mode: 'automatic'
    });
  }

  async rememberSomething(content: string, category: string = 'general') {
    // Chat normally - memory is recorded automatically
    const response = await this.ai.chat({
      messages: [
        { role: 'user', content: `Remember: ${content}` }
      ]
    });

    console.log(`Recorded memory: ${response.chatId}`);
    return response.chatId;
  }

  async recallInformation(query: string) {
    // Search for relevant memories
    const memories = await this.ai.searchMemories(query, {
      limit: 5
    });

    return memories.map(memory => memory.content);
  }
}

// Usage
const app = new SimpleMemoryApp();

await app.rememberSomething('TypeScript is a superset of JavaScript');
const memories = await app.recallInformation('TypeScript');
console.log('Recalled:', memories);
```

## 2. AI Chatbot with Memory

```typescript
import { MemoriAI } from 'memorits';

class MemoryEnabledChatbot {
  private ai: MemoriAI;
  private sessionId: string;

  constructor(apiKey: string) {
    // Create MemoriAI instance with simple configuration
    this.ai = new MemoriAI({
      databaseUrl: 'file:./memori.db',
      apiKey: apiKey,
      model: 'gpt-4',
      provider: 'openai',
      mode: 'automatic'
    });
    this.sessionId = this.generateSessionId();
  }

  async chat(userMessage: string) {
    try {
      // Chat normally - memory is recorded automatically
      const response = await this.ai.chat({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant with memory capabilities. Use your memory to provide contextually relevant responses.'
          },
          { role: 'user', content: userMessage }
        ]
      });

      return response.message.content;

    } catch (error) {
      console.error('Chat error:', error);
      return 'Sorry, I encountered an error processing your message.';
    }
  }

  async searchChatHistory(query: string) {
    // Search through conversation history
    const memories = await this.ai.searchMemories(query, {
      limit: 10
    });

    return memories.map(memory => ({
      content: memory.content,
      importance: memory.metadata?.importanceScore,
      createdAt: memory.metadata?.createdAt
    }));
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Usage
const chatbot = new MemoryEnabledChatbot('your-api-key');

console.log(await chatbot.chat('My name is Alice and I love programming'));
console.log(await chatbot.chat('What is my name?'));

const history = await chatbot.searchChatHistory('Alice');
console.log('Chat history:', history);
```

## 3. Personal Knowledge Base

```typescript
import { MemoriAI } from 'memorits';

class PersonalKnowledgeBase {
  private ai: MemoriAI;

  constructor() {
    this.ai = new MemoriAI({
      databaseUrl: 'file:./knowledge.db',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4',
      provider: 'openai',
      mode: 'automatic'
    });
  }

  async addKnowledge(topic: string, content: string) {
    // Chat normally - knowledge is recorded automatically
    const response = await this.ai.chat({
      messages: [
        { role: 'user', content: `Remember this about ${topic}: ${content}` }
      ]
    });

    console.log(`Added knowledge: ${topic} (${response.chatId})`);
    return response.chatId;
  }

  async searchKnowledge(query: string) {
    // Search knowledge base
    const results = await this.ai.searchMemories(query, {
      limit: 20
    });

    return results.map(result => ({
      content: result.content,
      topic: result.metadata?.topic,
      category: result.metadata?.category,
      importance: result.metadata?.importanceScore,
      confidence: result.metadata?.confidenceScore,
      createdAt: result.metadata?.createdAt
    }));
  }

  async getTopicsByCategory() {
    // Get all unique topics organized by category
    const allMemories = await this.ai.searchMemories('', {
      limit: 1000
    });

    const topicsByCategory = allMemories.reduce((acc, memory) => {
      const category = memory.metadata?.category || 'general';
      const topic = memory.metadata?.topic;

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

// Add some knowledge
await knowledgeBase.addKnowledge(
  'TypeScript',
  'TypeScript is a strongly typed programming language that builds on JavaScript'
);

await knowledgeBase.addKnowledge(
  'React Hooks',
  'React Hooks let you use state and other React features in functional components'
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
import { MemoriAI } from 'memorits';

class TaskReminderSystem {
  private ai: MemoriAI;

  constructor() {
    this.ai = new MemoriAI({
      databaseUrl: 'file:./tasks.db',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4',
      provider: 'openai',
      mode: 'automatic'
    });
  }

  async addTask(task: string, priority: 'low' | 'medium' | 'high' = 'medium', dueDate?: Date) {
    const taskContent = dueDate
      ? `Task: ${task} (Due: ${dueDate.toISOString()})`
      : `Task: ${task}`;

    // Chat normally - task is recorded automatically
    const response = await this.ai.chat({
      messages: [
        { role: 'user', content: taskContent }
      ]
    });

    console.log(`Added task: ${task} (${response.chatId})`);
    return response.chatId;
  }

  async getTasksByPriority(priority?: 'low' | 'medium' | 'high') {
    const searchQuery = priority ? `Task: ${priority} priority` : 'Task:';

    const results = await this.ai.searchMemories(searchQuery, {
      limit: 50
    });

    return results.map(result => ({
      id: result.id,
      task: result.content.replace('Task: ', ''),
      priority: result.metadata?.priority,
      dueDate: result.metadata?.dueDate ? new Date(result.metadata.dueDate) : null,
      status: result.metadata?.status,
      createdAt: result.metadata?.createdAt
    }));
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

// Usage
const taskSystem = new TaskReminderSystem();

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
import { MemoriAI } from 'memorits';

class LearningProgressTracker {
  private ai: MemoriAI;

  constructor() {
    this.ai = new MemoriAI({
      databaseUrl: 'file:./learning.db',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4',
      provider: 'openai',
      mode: 'automatic'
    });
  }

  async logLearningSession(
    topic: string,
    content: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ) {
    // Chat normally - learning session is recorded automatically
    const response = await this.ai.chat({
      messages: [
        { role: 'user', content: `Learning: ${topic} - ${content}` }
      ]
    });

    console.log(`Logged learning session: ${topic}`);
    return response.chatId;
  }

  async getLearningProgress(topic?: string) {
    const searchQuery = topic ? `Learning: ${topic}` : 'Learning:';

    const results = await this.ai.searchMemories(searchQuery, {
      limit: 100
    });

    return results.map(result => ({
      topic: result.metadata?.topic,
      difficulty: result.metadata?.difficulty,
      content: result.content,
      sessionDate: result.metadata?.sessionDate,
      importance: result.metadata?.importanceScore
    }));
  }

  async getTopicsByDifficulty() {
    const allLearning = await this.getLearningProgress();

    return allLearning.reduce((acc, session) => {
      const difficulty = session.difficulty || 'intermediate';
      const topic = session.topic;

      if (!acc[difficulty]) {
        acc[difficulty] = new Set();
      }
      if (topic) {
        acc[difficulty].add(topic);
      }

      return acc;
    }, {} as Record<string, Set<string>>);
  }

  async findWeakAreas() {
    // Find topics with low importance scores (indicating difficulty)
    const results = await this.ai.searchMemories('Learning:', {
      limit: 100
    });

    const learningSessions = results.filter(r => r.metadata?.type === 'learning');

    // Group by topic and calculate average importance
    const topicImportance = learningSessions.reduce((acc, session) => {
      const topic = session.metadata?.topic;
      const importance = session.metadata?.importanceScore || 0.5;

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
import { MemoriAI } from 'memorits';

class ContextAwareAssistant {
  private ai: MemoriAI;
  private userProfile: any = {};

  constructor(apiKey?: string) {
    // Create MemoriAI instance with simple configuration
    this.ai = new MemoriAI({
      databaseUrl: 'file:./assistant.db',
      apiKey: apiKey || process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4',
      provider: 'openai',
      mode: 'conscious'  // Use conscious mode for advanced context awareness
    });
  }

  async learnAboutUser(userInfo: string) {
    // Chat normally - user info is recorded automatically
    await this.ai.chat({
      messages: [
        { role: 'user', content: `User info: ${userInfo}` }
      ]
    });

    // Update user profile
    this.userProfile = await this.buildUserProfile();
  }

  async buildUserProfile() {
    // Build user profile from memories
    const userMemories = await this.ai.searchMemories('user info', {
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
    const context = await this.ai.searchMemories(question, {
      limit: 3
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

    const response = await this.ai.chat({
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    return response.message.content;
  }

  async getPersonalizedRecommendations() {
    // Get recommendations based on user profile
    const recommendations = await this.ai.searchMemories(
      'recommendations suggestions',
      { limit: 10 }
    );

    return recommendations.map(rec => ({
      content: rec.content,
      relevance: rec.score,
      category: rec.metadata?.category
    }));
  }
}

// Usage
const assistant = new ContextAwareAssistant();

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

## Related Documentation

- **[Integration Guide](../integration/openai-integration.md)** - Multi-provider integration patterns and drop-in replacements
- **[Provider Documentation](../providers/)** - Complete guides for OpenAI, Anthropic, Ollama, and custom providers
- **[Core API Reference](../api/core-api.md)** - Main Memori class and memory management APIs
- **[Advanced Examples](../../../examples/)** - Additional real-world usage examples and demos