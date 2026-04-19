# Reinforcement Learning Setup for Pixel Soccer League

## Overview

This directory contains the RL training infrastructure for PSL. Instead of manual parameter tuning, we use Deep Q-Network (DQN) to train AI agents on game objectives:

- **Shot selection** — when and where to shoot
- **Passing decisions** — which teammate to pass to
- **Movement & positioning** — where to run and stand
- **Dribbling** — when to carry the ball vs pass

## Architecture

### Components

1. **game_environment.py** — Gym-like wrapper around the running game server
   - Fetches game state via HTTP API
   - Converts state to neural network input
   - Calculates rewards based on outcomes
   
2. **dqn_agent.py** — Deep Q-Network implementation
   - Neural network for Q-value estimation
   - Experience replay buffer
   - Target network for stable learning
   - Epsilon-greedy exploration

3. **training_config.py** — Configuration and hyperparameters
   - Network architecture (sizes, layers)
   - Reward values for different outcomes
   - Training hyperparameters (learning rate, epsilon decay)

4. **train.py** — Main training loop
   - Runs episodes of training
   - Manages agent learning
   - Saves checkpoints and statistics

## Prerequisites

```bash
# Setup Python virtual environment
python -m venv venv_rl
source venv_rl/Scripts/activate  # Windows

# Install dependencies
pip install numpy tensorflow tensorflow-gpu requests
```

## Running Training

### 1. Start the game server (in main terminal)
```bash
cd /path/to/Pixel\ Soccer\ League
npm run dev
```

### 2. Run training (in separate terminal)
```bash
cd /path/to/Pixel\ Soccer\ League
source venv_rl/Scripts/activate
python rl/train.py
```

The trainer will:
- Connect to the game server at http://localhost:3001
- Run episodes, letting the DQN agent make decisions
- Learn from rewards (goals, shots on target, possession)
- Save models periodically
- Display progress: rewards, epsilon decay, network updates

## Hyperparameters

Key settings in `training_config.py`:

- **EPISODES** — Total training episodes (start with 100)
- **LEARNING_RATE** — Neural network learning rate (0.001)
- **DISCOUNT_FACTOR** — Future reward weight (0.99)
- **EPSILON_DECAY** — Exploration decay (0.995)
- **REWARD_GOAL** — Reward for scoring (100)
- **REWARD_SHOT_ON_TARGET** — Reward for shots on goal (5)

## Output

Training generates:
- **rl/models/dqn_model.h5** — Best trained model
- **rl/logs/checkpoint_ep*.json** — Per-episode checkpoints
- **rl/logs/training_stats.json** — Final statistics

## Next Steps

After initial training (100 episodes):

1. **Evaluate** — Run games with trained agent, measure win rate
2. **Fine-tune** — Adjust rewards if agent learns wrong behaviors
3. **Multi-agent** — Train separate agents for each position
4. **Integration** — Replace rule-based AI with learned policies

## Troubleshooting

**"Connection refused"** — Make sure game server is running on port 3001

**"Out of memory"** — Reduce REPLAY_BUFFER_SIZE or network layer sizes

**"Training too slow"** — Increase LEARNING_RATE or reduce BATCH_SIZE

**"Agent not improving"** — Adjust REWARD_* values to reinforce desired behaviors
