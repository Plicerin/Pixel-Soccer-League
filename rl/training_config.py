# Reinforcement Learning Configuration for Pixel Soccer League
# Trains neural networks for player decision-making (shot selection, passing, positioning)

import os

class RLConfig:
    # Environment
    GAME_SERVER_URL = "http://localhost:3001"
    GAME_SERVER_RECOVERY_ENDPOINT = "/recover-latest"
    GAME_SERVER_DB_ENDPOINT = "/__db/matches"

    # Training hyperparameters
    EPISODES = 100  # Start with 100 episodes for initial training
    STEPS_PER_EPISODE = 300  # Full match length
    LEARNING_RATE = 0.001
    DISCOUNT_FACTOR = 0.99
    EPSILON_DECAY = 0.995
    EPSILON_MIN = 0.01

    # Network architecture
    STATE_SIZE = 128  # Flattened game state (positions, velocities, etc)
    HIDDEN_LAYER_1 = 256
    HIDDEN_LAYER_2 = 128
    ACTION_SIZE = 4  # [pass, shoot, dribble, move]

    # Reward shaping
    REWARD_GOAL = 100.0
    REWARD_SHOT_ON_TARGET = 5.0
    REWARD_SUCCESSFUL_PASS = 0.5
    REWARD_POSSESSION = 0.1
    REWARD_FORWARD_PROGRESS = 0.2
    PENALTY_TURNOVER = -2.0
    PENALTY_FAILED_SHOT = -0.5

    # Training
    BATCH_SIZE = 32
    REPLAY_BUFFER_SIZE = 10000
    TARGET_NETWORK_UPDATE = 1000  # Steps between target network updates

    # Model paths
    MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
    LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")

    @staticmethod
    def ensure_dirs():
        os.makedirs(RLConfig.MODEL_DIR, exist_ok=True)
        os.makedirs(RLConfig.LOG_DIR, exist_ok=True)

if __name__ == "__main__":
    RLConfig.ensure_dirs()
    print("RL config initialized")
