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
            # Use database API to get latest match
            response = requests.get(f"{self.server_url}/__db/matches?limit=1", timeout=15)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    match = data[0]
                    # Parse bundle_json if it exists
                    if 'bundle_json' in match and isinstance(match['bundle_json'], str):
                        match['bundle'] = json.loads(match['bundle_json'])
                    return match
        except requests.exceptions.Timeout:
            pass  # Suppress timeout warnings
        except requests.exceptions.ConnectionError:
            pass  # Suppress connection errors
        except json.JSONDecodeError:
            pass  # Suppress JSON errors
        except Exception as e:
            pass  # Suppress other errors
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
            # Extract from database format
            state[0] = float(game_state.get('score_a', 0))
            state[1] = float(game_state.get('score_b', 0))
            state[2] = float(game_state.get('possession_a', 50))
            state[3] = float(game_state.get('shots_a', 0))
            state[4] = float(game_state.get('shots_b', 0))
            state[5] = float(game_state.get('shots_on_target_a', 0))
            state[6] = float(game_state.get('shots_on_target_b', 0))
            state[7] = float(game_state.get('elapsed_in_half', 0)) / 300.0
            state[8] = 1.0 if game_state.get('phase') == 'FULL_TIME' else 0.0

            # Bundle data if available
            if 'bundle' in game_state:
                bundle = game_state['bundle']
                state[10] = float(bundle.get('teamA', {}).get('possession', 50))
                state[11] = float(bundle.get('teamA', {}).get('shotsOnTarget', 0))
                state[12] = float(bundle.get('teamB', {}).get('shotsOnTarget', 0))

        except Exception as e:
            pass  # Suppress errors

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
        time.sleep(0.5)  # Wait for game to process frame

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
