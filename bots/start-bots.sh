#!/bin/bash
# Start Scout and Spark bots with duplicate prevention

# Kill any existing instances first
pkill -f "node.*bots-v2/scout/index.js" 2>/dev/null
pkill -f "node.*bots-v2/spark/index.js" 2>/dev/null
sleep 1

# Start Scout
cd /opt/mattermost/bots-v2/scout
nohup node index.js >> /var/log/mattermost/scout-bot.log 2>&1 &
SCOUT_PID=$!
echo "Started Scout bot with PID: $SCOUT_PID"

# Start Spark
cd /opt/mattermost/bots-v2/spark
nohup node index.js >> /var/log/mattermost/spark-bot.log 2>&1 &
SPARK_PID=$!
echo "Started Spark bot with PID: $SPARK_PID"

sleep 2
echo "Running processes:"
ps aux | grep -E "node.*(scout|spark)/index" | grep -v grep
