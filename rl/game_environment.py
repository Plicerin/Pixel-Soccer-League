# Game Environment Wrapper
# Provides gym-like interface to communicate with running game server

import requests
import json
import numpy as np
from typing import Tuple, Dict, Any
import time

class PSLGameEnvironment:
    """Gym-like interface for Pixel Soccer League"""

    def __init__(self, server_url: str = "http://localhost:3001"):
        self.server_url = server_url
        self.last_state = None
        self.episode_reward = 0.0
        self.steps = 0
        self.max_steps = 300

    def _get_game_state(self) -> Dict[str, Any]:
        """Fetch current game state from server"""
        try:
            response = requests.get(f"{self.server_url}/recover-latest", timeout=5)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Error fetching game state: {e}")
        return None

    def _extract_state_vector(self, game_state: Dict) -> np.ndarray:
        """
        Convert game state to neural network input vector
        Returns 128-dim state representation
        """
        state = np.zeros(128, dtype=np.float32)

        if not game_state:
            return state

        try:
            # Ball position (3 dims)
            ball = game_state.get('ball', {})
            state[0:3] = [ball.get('x', 0), ball.get('y', 0), ball.get('z', 0)]

            # Ball velocity (3 dims)
            state[3:6] = [
                ball.get('vx', 0),
                ball.get('vy', 0),
                ball.get('vz', 0)
            ]

            # Player positions (up to 22 players, 2 coords each = 44 dims)
            players = game_state.get('players', [])
            for i, player in enumerate(players[:22]):
                idx = 6 + (i * 2)
                state[idx] = player.get('x', 0)
                state[idx + 1] = player.get('z', 0)

            # Game state flags (remaining dims)
            # Possession (1 dim)
            state[50] = 1.0 if game_state.get('possession') == 'A' else 0.0

            # Score differential (1 dim)
            state[51] = float(game_state.get('scoreA', 0) - game_state.get('scoreB', 0))

            # Time (1 dim, normalized 0-1)
            elapsed = game_state.get('elapsed', 0)
            state[52] = min(elapsed / 300.0, 1.0)

        except Exception as e:
            print(f"Error extracting state: {e}")

        return state

    def reset(self) -> np.ndarray:
        """Reset environment and return initial state"""
        # Wait for fresh game to start
        time.sleep(2)

        game_state = self._get_game_state()
        self.last_state = game_state
        self.episode_reward = 0.0
        self.steps = 0

        return self._extract_state_vector(game_state)

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict]:
        """
        Execute action and return (state, reward, done, info)

        Actions:
        0 = pass
        1 = shoot
        2 = dribble
        3 = move to position
        """
        self.steps += 1
        time.sleep(0.1)  # Small delay to allow game to progress

        game_state = self._get_game_state()
        if game_state is None:
            # Server error - episode fails
            return self._extract_state_vector(self.last_state), -10.0, True, {"reason": "server_error"}

        # Calculate reward based on state change
        reward = self._calculate_reward(self.last_state, game_state, action)
        self.episode_reward += reward

        # Check if episode is done
        done = (
            self.steps >= self.max_steps or
            game_state.get('phase') == 'FULL_TIME' or
            game_state.get('phase') == 'ENDED'
        )

        info = {
            "scoreA": game_state.get('scoreA', 0),
            "scoreB": game_state.get('scoreB', 0),
            "possession": game_state.get('possession'),
            "phase": game_state.get('phase'),
        }

        self.last_state = game_state
        state = self._extract_state_vector(game_state)

        return state, reward, done, info

    def _calculate_reward(self, prev_state: Dict, curr_state: Dict, action: int) -> float:
        """Calculate reward based on state transition"""
        from training_config import RLConfig

        reward = 0.0

        if not prev_state or not curr_state:
            return reward

        # Goal reward
        prev_score_a = prev_state.get('scoreA', 0)
        curr_score_a = curr_state.get('scoreA', 0)
        if curr_score_a > prev_score_a:
            reward += RLConfig.REWARD_GOAL

        # Shot on target reward
        prev_shots_on_target = prev_state.get('shotsOnTargetA', 0)
        curr_shots_on_target = curr_state.get('shotsOnTargetA', 0)
        if curr_shots_on_target > prev_shots_on_target:
            reward += RLConfig.REWARD_SHOT_ON_TARGET

        # Possession reward (small bonus for maintaining possession)
        if curr_state.get('possession') == 'A':
            reward += RLConfig.REWARD_POSSESSION

        # Forward progress reward
        prev_x = self._get_carrier_x(prev_state)
        curr_x = self._get_carrier_x(curr_state)
        if curr_x > prev_x:  # Moving toward opponent goal
            reward += RLConfig.REWARD_FORWARD_PROGRESS

        # Turnover penalty
        prev_poss = prev_state.get('possession')
        curr_poss = curr_state.get('possession')
        if prev_poss == 'A' and curr_poss == 'B':
            reward += RLConfig.PENALTY_TURNOVER

        return reward

    def _get_carrier_x(self, state: Dict) -> float:
        """Get X position of ball carrier"""
        if not state:
            return 0.0
        ball = state.get('ball', {})
        return ball.get('x', 0.0)

    def close(self):
        """Clean up resources"""
        pass
