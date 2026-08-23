# Google Research Football RL Training in Colab

Train a DQN agent on Google Research Football, then integrate the model into PSL.

## Quick Start

### 1. Open in Colab

Click here to open the training notebook:
[Google Research Football Example](https://colab.research.google.com/github/google-research/football/blob/master/gfootball/colabs/gfootball_example_from_prebuild.ipynb)

### 2. Use Our Training Script

In a new Colab cell, run:

```python
# Upload the training script or copy-paste colab_training.py

# Run training (100 episodes, ~30-60 minutes)
from colab_training import train_on_grfootball
agent = train_on_grfootball(episodes=100)
```

### 3. Download Results

After training completes, download:
- `grfootball_dqn_model.h5` — Trained model weights
- `grfootball_training_stats.json` — Training statistics

## What This Does

Trains a DQN agent on Google Research Football's 11v11 environment:
- **State**: Simple 115-dimensional observation (player positions, ball, etc)
- **Actions**: 19 discrete actions (pass, shoot, move, etc)
- **Reward**: Goals scored, -1 for conceding
- **Episodes**: 100 (can increase for better performance)

Expected results after 100 episodes:
- Average reward: 0.5-2.0 goals/episode
- Max reward: 5-10 goals/episode
- Total training time: 1-2 hours

## After Training

### 1. Load the Model

```python
import tensorflow as tf
model = tf.keras.models.load_model('grfootball_dqn_model.h5')
```

### 2. Use in PSL

Create an adapter to:
- Feed PSL game state as input
- Get DQN action output
- Map to PSL player actions (pass/shoot/dribble)
- Apply to game engine

### 3. Evaluate

Test the trained agent in PSL games and measure:
- Goals per game
- Win rate
- Decision quality

## Architecture

- **State**: 115-dim observation (GRFootball simple115)
- **Network**: 115 → 256 → 128 → 19 (action space)
- **Training**: DQN with experience replay, target network
- **Hyperparameters**:
  - Learning rate: 0.001
  - Gamma (discount): 0.99
  - Epsilon decay: 0.995
  - Batch size: 32

## Why GRFootball?

✅ Full 11v11 soccer simulation
✅ Realistic rules and physics
✅ Built for RL research
✅ Free, fast, no rendering needed
✅ Multiple difficulty levels
✅ Transferable to real game

## Troubleshooting

**Installation fails**: Use `!pip install google-research-football` in Colab

**Training too slow**: Reduce episodes or use `env_name='academy_3_vs_1_with_keeper'` (easier)

**GPU not available**: Enable GPU in Colab Runtime settings (Runtime → Change runtime type → GPU)

## Next Steps

1. ✅ Train on GRFootball (this notebook)
2. Download trained model
3. Integrate into PSL game engine
4. Evaluate on PSL matches
5. Fine-tune if needed

## References

- [Google Research Football GitHub](https://github.com/google-research/football)
- [GRFootball Documentation](https://github.com/google-research/football/wiki)
- [DQN Paper](https://arxiv.org/abs/1312.5602)
