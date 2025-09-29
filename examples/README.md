# Memori TypeScript Examples

This directory contains comprehensive examples demonstrating how to use the Memori TypeScript library for memory-enabled conversations with both OpenAI and Ollama.

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **npm** or **yarn** package manager
3. **Database**: SQLite (configured by default) or PostgreSQL/MySQL
4. **AI Backend**: Either OpenAI API or Ollama

## Environment Configuration

The examples use the following environment variables (set in `.env`):

```env
# Database Configuration
DATABASE_URL="file:./memori.db"

# Namespace for memory isolation
MEMORI_NAMESPACE="development"

# Memory Processing Settings
MEMORI_CONSCIOUS_INGEST="false"  # Enable conscious ingestion mode
MEMORI_AUTO_INGEST="true"        # Enable automatic memory processing

# AI Model Configuration
MEMORI_MODEL="gpt-4o-mini"

# OpenAI Configuration (for OpenAI backend)
OPENAI_API_KEY="your-openai-api-key-here"

# Base URL for API calls
# For OpenAI: leave empty or remove this line
# For Ollama: http://localhost:11434/v1
OPENAI_BASE_URL="http://localhost:11434/v1"
```

### Setting up OpenAI

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Set the following in your `.env` file:
   ```env
   OPENAI_API_KEY="your-actual-api-key"
   # Remove or comment out OPENAI_BASE_URL for OpenAI
   ```

### Setting up Ollama

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Start the Ollama server:
   ```bash
   ollama serve
   ```
3. Pull a model:
   ```bash
   ollama pull llama2
   ollama pull codellama
   ```
4. Set the following in your `.env` file:
   ```env
   OPENAI_BASE_URL="http://localhost:11434/v1"
   OPENAI_API_KEY="not-needed-for-ollama"
   MEMORI_MODEL="llama2"
   ```

## Running Examples

### Using npm Scripts

The examples can be run using the following npm scripts:

```bash
# Basic usage example
npm run example:basic

# Ollama-specific integration example
npm run example:ollama

# OpenAI-specific integration example
npm run example:openai

# Memory search and retrieval example
npm run example:search

# Dual memory mode demonstration
npm run example:dual-memory

# Performance dashboard demonstration
npm run example:performance-dashboard
```

### Running Individual Examples Directly

You can also run examples directly with tsx:

```bash
# Basic usage
npx tsx examples/basic-usage.ts

# Ollama integration
npx tsx examples/ollama-integration.ts

# OpenAI integration
npx tsx examples/openai-integration.ts

# Memory search
npx tsx examples/memory-search.ts

# Dual memory mode
npx tsx examples/dual-memory-mode.ts

# Performance dashboard
npx tsx examples/performance-dashboard.ts
```

## Example Descriptions

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates fundamental Memori operations:
- Initializing Memori with environment configuration
- Recording conversations
- Searching and retrieving memories
- Proper cleanup and error handling

**Expected Output:**
- Configuration loading confirmation
- Conversation recording with IDs
- Memory search results for "TypeScript" and "interfaces"
- Successful cleanup confirmation

### 2. Ollama Integration (`ollama-integration.ts`)

Shows how to configure and use Memori with Ollama:
- Ollama-specific configuration validation
- Local LLM conversation recording
- Memory processing with local models
- Error handling for common Ollama issues

**Expected Output:**
- Ollama configuration validation
- Multiple conversation recordings with metadata
- Memory searches for "local LLM", "efficient", and "programming"
- Troubleshooting suggestions if Ollama is not available

### 3. OpenAI Integration (`openai-integration.ts`)

Demonstrates OpenAI API integration:
- OpenAI API key validation
- GPT model conversation recording
- Memory processing with OpenAI models
- Rate limiting and error handling

**Expected Output:**
- OpenAI configuration validation
- API key verification
- Conversation recordings with programming concepts
- Memory searches for "JavaScript", "async", and "React"
- API usage guidance

### 4. Memory Search (`memory-search.ts`)

Advanced memory search and retrieval demonstration:
- Building a diverse memory base
- Various search query types
- Cross-topic memory relationships
- Category-based memory organization

**Expected Output:**
- Comprehensive memory database creation
- Multiple search demonstrations across different topics
- Category analysis and memory relationships
- Semantic search capabilities showcase

### 5. Dual Memory Mode (`dual-memory-mode.ts`)

Comprehensive demonstration of Memori's dual memory processing modes:
- **Auto-ingestion mode**: Automatic conversation processing into memories
- **Conscious ingestion mode**: Manual processing with background monitoring
- **Mode status checking**: Query current processing state
- **Background processing**: Configurable monitoring intervals

**Expected Output:**
- Auto-ingestion mode demonstration with automatic memory processing
- Conscious ingestion mode with manual processing triggers
- Background monitoring configuration and status
- Mode status verification and comparison

### 6. Performance Dashboard (`performance-dashboard.ts`)

Comprehensive demonstration of Memori's performance monitoring and alerting capabilities:
- **Dashboard initialization**: Setting up default widgets and real-time collection
- **System status monitoring**: Overall health and component-specific metrics
- **Real-time metrics**: Collection and analysis of performance data
- **Alert management**: Threshold-based alerting and acknowledgment system
- **Performance reporting**: Detailed analysis and trend identification
- **Widget management**: Dynamic dashboard configuration and updates

**Expected Output:**
- Dashboard service initialization with default widgets
- Real-time system status overview with component health
- Live metrics collection and alert generation
- Performance report generation with trends and recommendations
- Alert acknowledgment and resolution workflow
- Dashboard configuration export and management

## Expected Output Examples

### Basic Usage Example Output
```
🚀 Starting Basic Memori Usage Example...

📋 Configuration loaded: {
  databaseUrl: 'file:./memori.db',
  namespace: 'development',
  model: 'gpt-4o-mini',
  baseUrl: 'http://localhost:11434/v1'
}

✅ Memori instance created
✅ Memori enabled successfully

💬 Recording conversation...
✅ Conversation recorded with ID: abc-123-def

🔍 Searching memories for "TypeScript"...
✅ Found 3 relevant memories:
1. TypeScript is a superset of JavaScript...
2. Variables can be declared with type annotations...
3. Interfaces define object structures...

🎉 Basic usage example completed successfully!
```

### Ollama Integration Example Output
```
🚀 Starting Ollama Integration Example...

📋 Ollama Configuration: {
  databaseUrl: 'file:./memori.db',
  namespace: 'development',
  model: 'llama2',
  baseUrl: 'http://localhost:11434/v1'
}

✅ Memori instance created with Ollama backend
✅ Memori enabled successfully

💬 Recording conversations with Ollama context...
✅ Conversation 1 recorded: def-456-ghi
✅ Conversation 2 recorded: ghi-789-jkl

🔍 Searching memories for "local LLM"...
✅ Found 2 memories about local LLMs:
1. Local LLMs provide privacy and control...
2. You can run models efficiently on local hardware...

🎉 Ollama integration example completed successfully!
```

### Performance Dashboard Example Output
```
🚀 Starting Performance Dashboard Example

✅ Performance dashboard service initialized
✅ Dashboard initialized with default widgets
✅ Alert callback registered

📊 Getting system status overview...
System Status Overview: healthy, 0 active alerts, 0 recent incidents

🎛️ Getting dashboard widgets...
Found 5 dashboard widgets:
Widget: System Overview (status_indicator)
Widget: Search Performance (metric_chart)
Widget: Database Metrics (metric_chart)
Widget: Active Alerts (alert_list)
Widget: Performance Trends (trend_analysis)

📈 Collecting real-time metrics...
Search latency metrics: 10 samples
Database latency metrics: 10 samples
System error rate metrics: 10 samples

📸 Getting performance snapshots...
Retrieved 3 performance snapshots

📊 Generating performance report...
Performance Report Generated: daily report with healthy status

📈 Analyzing performance trends...
Updated trend analysis for widgets

Alert Summary by Severity: 0 critical, 0 error, 0 warning

💾 Exporting dashboard configuration...
Dashboard configuration exported: 5 widgets configured

🎉 Performance dashboard example completed successfully!
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
- Ensure `DATABASE_URL` is properly set in `.env`
- For SQLite: use `file:./memori.db` (default)
- For PostgreSQL: use `postgresql://user:password@localhost:5432/memori`

#### 2. OpenAI API Errors
- Verify `OPENAI_API_KEY` is set and valid
- Check your OpenAI account has sufficient credits
- Ensure you're not hitting rate limits

#### 3. Ollama Connection Errors
- Make sure Ollama is installed and running
- Check if the service is on port 11434
- Verify the model is downloaded: `ollama pull llama2`

#### 4. Memory Processing Issues
- Ensure memory processing is enabled in configuration
- Check that conversations are being recorded properly
- Wait for asynchronous memory processing to complete

### Debug Mode

To enable verbose logging, set the following in your `.env`:
```env
DEBUG=memori:*
```

### Getting Help

If you encounter issues:

1. Check the error messages in the console output
2. Verify your environment configuration
3. Ensure all prerequisites are installed
4. Try running the basic example first to isolate issues
5. Check the [Memori documentation](../README.md) for more details

## Advanced Configuration

For production use, consider these additional settings:

```env
# Production database
DATABASE_URL="postgresql://user:password@prod-host:5432/memori"

# Production namespace
MEMORI_NAMESPACE="production"

# Enable memory features
MEMORI_CONSCIOUS_INGEST="true"
MEMORI_AUTO_INGEST="true"

# User context for better memory processing
MEMORI_USER_CONTEXT='{
  "userPreferences": ["TypeScript", "React", "Node.js"],
  "currentProjects": ["web-app", "api-service"],
  "relevantSkills": ["fullstack", "devops", "ai"]
}'
```

## Next Steps

After running these examples:

1. **Experiment** with different conversation topics
2. **Customize** the memory search queries
3. **Integrate** Memori into your own applications
4. **Explore** advanced configuration options
5. **Contribute** your own examples to the project

For more information, see the main [README](../README.md) and explore the source code in the `src/` directory.