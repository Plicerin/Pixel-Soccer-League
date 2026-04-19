# RL Training Quick Start

The custom rule-based system has fundamental architectural problems that can't be fixed with parameter tuning. We're switching to reinforcement learning using a DQN agent.

## What Changed

❌ **Old approach (discarded):**
- Manual parameter tweaking (shooting distance, goalkeeper saves, pass gates)
- Every change had random/negative impact
- Strikers never scored despite perfect aiming
- Frozen players, broken decision trees
- Wasted 20+ hours on tuning

✅ **New approach (RL-based):**
- Agent learns optimal decisions via gameplay
- Reward signal guides learning (goals=+100, shots on target=+5, etc)
- Neural network generalizes across situations
- Self-improving: better decisions lead to more rewards
- Scalable: train once, deploy everywhere

## Quick Start

### 1. Terminal 1 — Start the game server
```bash
cd /path/to/Pixel\ Soccer\ League
npm run dev
```
Server runs on http://localhost:3001

### 2. Terminal 2 — Activate Python environment & train
```bash
cd /path/to/Pixel\ Soccer\ League
source venv_rl/Scripts/activate  # Windows

python rl/train.py
```

The trainer will:
- Run 100 episodes of gameplay
- DQN agent learns decision-making
- Print progress every episode
- Save best model automatically
- Takes ~1-2 hours for initial training

### 3. Monitor progress
```
Episode 1/100 | Reward: 12.50 | Avg (100): 12.50 | Steps: 245 | Epsilon: 0.995
Episode 2/100 | Reward: 8.30 | Avg (100): 10.40 | Steps: 198 | Epsilon: 0.990
Episode 3/100 | Reward: 15.70 | Avg (100): 12.17 | Steps: 267 | Epsilon: 0.985
...
Episode 100/100 | Reward: 45.20 | Avg (100): 28.50 | Steps: 288 | Epsilon: 0.604
```

**Key metrics:**
- **Reward** — Total reward this episode (higher = better)
- **Avg** — Rolling average of last 100 episodes
- **Epsilon** — Exploration rate (starts at 1.0, decays toward 0.01)

## What's Being Trained

The DQN agent learns:
1. **Shot selection** — When and where strikers should shoot
2. **Passing decisions** — Who to pass to based on game state
3. **Positioning** — Where to run and stand defensively/offensively
4. **Movement** — Dribble vs pass vs hold decisions

## Expected Results

### Phase 1 (Episodes 1-20)
- Random behavior, low rewards
- Agent explores different actions
- High epsilon (lots of random choices)

### Phase 2 (Episodes 20-50)
- Learning kicks in
- Rewards start improving
- Epsilon decaying (fewer random choices)

### Phase 3 (Episodes 50-100)
- Convergence toward learned policy
- Consistent reward levels
- Epsilon near minimum (mostly learned decisions)

## Next Steps After Training

1. **Evaluate** — Test trained agent in games
   ```bash
   python rl/evaluate.py models/dqn_model.h5
   ```

2. **Deploy** — Replace rule-based AI with learned model
   - Load model in gameEngine.ts
   - Use neural network outputs for decisions

3. **Fine-tune** — If needed:
   - Adjust reward values in training_config.py
   - Train for more episodes
   - Experiment with different architectures

## Troubleshooting

**"Connection refused"**
- Make sure game server is running on port 3001
- Check: http://localhost:3001 in browser

**"Out of memory"**
- Reduce REPLAY_BUFFER_SIZE (default 10000)
- Reduce network layer sizes (HIDDEN_LAYER_1, etc)

**"Training stuck at same reward"**
- Increase LEARNING_RATE (try 0.005)
- Adjust reward values (increase goals = +100)
- Check if game server is responsive

**"Agent not making progress"**
- Verify game server is giving varied state inputs
- Check reward calculations in game_environment.py
- Try shorter episodes (reduce max_steps)

## Files

- `rl/train.py` — Main training script
- `rl/training_config.py` — Hyperparameters
- `rl/dqn_agent.py` — Neural network agent
- `rl/game_environment.py` — Game state interface
- `rl/models/` — Saved model weights
- `rl/logs/` — Training statistics

## References

- **DQN paper:** Playing Atari with Deep Reinforcement Learning (Mnih et al, 2013)
- **Gym docs:** https://gymnasium.farama.org/
- **TensorFlow Keras:** https://www.tensorflow.org/guide/keras
