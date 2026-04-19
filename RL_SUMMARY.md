# Reinforcement Learning Setup — Summary

## What Was Done

Created a complete reinforcement learning infrastructure to replace the broken rule-based AI system.

### Why RL?

The custom rule-based system had fundamental flaws:
- **Strikers never scored on target** (0% success rate across 4+ games)
- **Every parameter change had random/negative impact**
- **Frozen players** due to decision logic bugs
- **20+ hours of tuning yielded no improvement**
- **Even perfect aiming didn't help** — problem is systemic, not tactical

**Decision: Switch to Deep Q-Network (DQN) reinforcement learning**

### What's Included

#### 1. **Game Environment Wrapper** (`rl/game_environment.py`)
- Communicates with running game via HTTP API
- Extracts game state (ball, player positions, scores)
- Converts state to neural network input (128-dim vector)
- Calculates rewards:
  - `+100` for goals
  - `+5` for shots on target
  - `+0.5` for completed passes
  - `-2` for turnovers
  - Small bonuses for possession and forward progress

#### 2. **DQN Agent** (`rl/dqn_agent.py`)
- Neural network (256→128 hidden layers)
- Experience replay buffer (10,000 transitions)
- Epsilon-greedy exploration (starts 1.0, decays to 0.01)
- Target network for stable learning
- Can save/load trained models

#### 3. **Training Loop** (`rl/train.py`)
- Runs episodes of gameplay
- Agent learns from rewards
- Saves best model automatically
- Displays progress every episode
- Checkpoints every 10 episodes

#### 4. **Configuration** (`rl/training_config.py`)
- Hyperparameters (learning rate, discount factor, epsilon decay)
- Network architecture (layer sizes)
- Reward values (customizable)
- Paths for models and logs

#### 5. **Documentation**
- `RL_SETUP.md` — Detailed technical setup
- `RL_QUICKSTART.md` — Quick start guide
- This file — overview

## How to Run

### Prerequisites
```bash
# Python 3.9+ with TensorFlow, numpy, requests
# Virtual environment already set up: venv_rl/
```

### Start Training

**Terminal 1 — Game Server:**
```bash
cd /path/to/Pixel\ Soccer\ League
npm run dev
```

**Terminal 2 — Training:**
```bash
cd /path/to/Pixel\ Soccer\ League
source venv_rl/Scripts/activate
python rl/train.py
```

### Monitor Progress
```
Episode 1/100 | Reward: 12.50 | Avg (100): 12.50 | Epsilon: 0.995
Episode 2/100 | Reward: 8.30  | Avg (100): 10.40 | Epsilon: 0.990
...
Episode 100/100 | Reward: 45.20 | Avg (100): 28.50 | Epsilon: 0.604

Training Complete!
Episodes: 100
Avg Reward: 28.50
Max Reward: 45.20
Stats saved to: rl/logs/training_stats.json
```

## Expected Timeline

| Phase | Episodes | Time | Behavior |
|-------|----------|------|----------|
| Exploration | 1-20 | 20-30m | Random, low rewards |
| Learning | 20-50 | 30-50m | Improving, epsilon decay |
| Convergence | 50-100 | 30-50m | Stable rewards, learned policy |
| **Total** | **100** | **~2 hours** | **Ready for deployment** |

## After Training

### 1. Evaluate
Check model performance on test games:
```bash
python rl/evaluate.py models/dqn_model.h5 --episodes 10
```

### 2. Deploy
Integrate trained model into game:
- Load `rl/models/dqn_model.h5` in gameEngine.ts
- Replace rule-based AI with neural network outputs
- Test in live matches

### 3. Fine-tune (if needed)
If training shows poor results:
- Increase REWARD_GOAL (e.g., 150 instead of 100)
- Increase LEARNING_RATE (e.g., 0.005)
- Add more training episodes (200 instead of 100)
- Adjust EPSILON_DECAY (e.g., 0.99 instead of 0.995)

## Files Generated

During training:
- `rl/models/dqn_model.h5` — Best trained model
- `rl/logs/checkpoint_ep10.json` — Checkpoint after 10 episodes
- `rl/logs/checkpoint_ep20.json` — Checkpoint after 20 episodes
- ... (every 10 episodes)
- `rl/logs/training_stats.json` — Final statistics

## Key Design Decisions

1. **DQN (not Policy Gradient)** — More stable, better for discrete actions
2. **Experience Replay** — Decorrelates training data, improves sample efficiency
3. **Target Network** — Prevents Q-value overestimation
4. **HTTP Game Interface** — No need to modify game code, can train while playing
5. **Modular Design** — Easy to experiment with different rewards/architectures

## Troubleshooting

**"Connection refused"**
```bash
# Check server is running
curl http://localhost:3001
```

**"Out of memory"**
```python
# Reduce in training_config.py
REPLAY_BUFFER_SIZE = 5000  # from 10000
HIDDEN_LAYER_1 = 128  # from 256
```

**"Training stuck"**
```python
# Increase learning signal
REWARD_GOAL = 150  # from 100
REWARD_SHOT_ON_TARGET = 10  # from 5
```

## Next Steps

1. ✅ Setup complete
2. Run training (`python rl/train.py`)
3. Evaluate on test games
4. Deploy to game
5. Monitor live performance
6. Iterate if needed

## References

- **DQN Paper:** [Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602)
- **Gym Docs:** https://gymnasium.farama.org/
- **TensorFlow Guide:** https://tensorflow.org/guide
