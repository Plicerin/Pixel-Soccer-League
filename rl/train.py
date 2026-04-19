#!/usr/bin/env python
"""
Main training script for Pixel Soccer League RL
Trains DQN agent on game server via HTTP API
"""

import sys
import os
import json
import numpy as np
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from training_config import RLConfig
from game_environment import PSLGameEnvironment
from dqn_agent import DQNAgent

class PSLTrainer:
    def __init__(self, config: RLConfig):
        self.config = config
        self.config.ensure_dirs()

        # Initialize environment and agent
        self.env = PSLGameEnvironment(config.GAME_SERVER_URL)
        self.agent = DQNAgent(config.STATE_SIZE, config.ACTION_SIZE, config)

        # Training tracking
        self.episode_rewards = []
        self.episode_lengths = []

    def train_episode(self) -> Tuple[float, int]:
        """Train one episode"""
        state = self.env.reset()
        total_reward = 0.0
        steps = 0

        while True:
            # Choose and execute action
            action = self.agent.act(state)
            next_state, reward, done, info = self.env.step(action)

            # Store experience and train
            self.agent.remember(state, action, reward, next_state, done)
            self.agent.replay(self.config.BATCH_SIZE)

            total_reward += reward
            steps += 1
            state = next_state

            if done:
                break

        return total_reward, steps

    def run(self):
        """Run training loop"""
        print(f"Starting PSL RL Training at {datetime.now()}")
        print(f"Episodes: {self.config.EPISODES}")
        print(f"Server: {self.config.GAME_SERVER_URL}")
        print("-" * 60)

        best_reward = float('-inf')

        try:
            for episode in range(self.config.EPISODES):
                reward, steps = self.train_episode()
                self.episode_rewards.append(reward)
                self.episode_lengths.append(steps)

                avg_reward = np.mean(self.episode_rewards[-100:])

                print(f"Episode {episode + 1}/{self.config.EPISODES} | "
                      f"Reward: {reward:.2f} | "
                      f"Avg (100): {avg_reward:.2f} | "
                      f"Steps: {steps} | "
                      f"Epsilon: {self.agent.epsilon:.3f}")

                # Save best model
                if reward > best_reward:
                    best_reward = reward
                    self.agent.save(self.config.MODEL_DIR)
                    print(f"  -> New best reward! Saved model.")

                # Periodic checkpoint
                if (episode + 1) % 10 == 0:
                    self.save_checkpoint(episode)

        except KeyboardInterrupt:
            print("\nTraining interrupted by user")
        except Exception as e:
            print(f"Training error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.env.close()
            self.save_final_stats()

    def save_checkpoint(self, episode: int):
        """Save training checkpoint"""
        checkpoint = {
            "episode": episode,
            "episode_rewards": self.episode_rewards,
            "episode_lengths": self.episode_lengths,
            "epsilon": self.agent.epsilon,
        }

        checkpoint_path = os.path.join(self.config.LOG_DIR, f"checkpoint_ep{episode}.json")
        with open(checkpoint_path, 'w') as f:
            json.dump(checkpoint, f, indent=2)

    def save_final_stats(self):
        """Save final training statistics"""
        stats = {
            "total_episodes": len(self.episode_rewards),
            "avg_reward": float(np.mean(self.episode_rewards)),
            "max_reward": float(np.max(self.episode_rewards)),
            "min_reward": float(np.min(self.episode_rewards)),
            "avg_length": float(np.mean(self.episode_lengths)),
            "training_time": datetime.now().isoformat(),
        }

        stats_path = os.path.join(self.config.LOG_DIR, "training_stats.json")
        with open(stats_path, 'w') as f:
            json.dump(stats, f, indent=2)

        print("\nTraining Complete!")
        print(f"Episodes: {stats['total_episodes']}")
        print(f"Avg Reward: {stats['avg_reward']:.2f}")
        print(f"Max Reward: {stats['max_reward']:.2f}")
        print(f"Stats saved to: {stats_path}")

if __name__ == "__main__":
    config = RLConfig()
    trainer = PSLTrainer(config)
    trainer.run()
