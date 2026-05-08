import type { PlayerIntent, PlayerBelief, TacticalBlackboard, MatchBelief } from "../core/types";

export type BTStatus = "success" | "failure" | "running";

export type BTContext = {
  player: PlayerBelief;
  belief: MatchBelief;
  blackboard: TacticalBlackboard;
  lastIntent: PlayerIntent | null;
  candidates: PlayerIntent[];
};

export type BTNode = {
  id: string;
  tick: (ctx: BTContext) => BTStatus;
};

export function selector(id: string, children: BTNode[]): BTNode {
  return {
    id,
    tick(ctx: BTContext) {
      for (const child of children) {
        const status = child.tick(ctx);
        if (status !== "failure") return status;
      }
      return "failure";
    },
  };
}

export function sequence(id: string, children: BTNode[]): BTNode {
  return {
    id,
    tick(ctx: BTContext) {
      for (const child of children) {
        const status = child.tick(ctx);
        if (status !== "success") return status;
      }
      return "success";
    },
  };
}

export function condition(
  id: string,
  check: (ctx: BTContext) => boolean,
): BTNode {
  return {
    id,
    tick(ctx: BTContext) {
      return check(ctx) ? "success" : "failure";
    },
  };
}

export function action(
  id: string,
  execute: (ctx: BTContext) => PlayerIntent | null,
): BTNode {
  return {
    id,
    tick(ctx: BTContext) {
      const intent = execute(ctx);
      if (intent) {
        ctx.candidates.push(intent);
        return "success";
      }
      return "failure";
    },
  };
}

export function decorator(
  id: string,
  child: BTNode,
  modify: (status: BTStatus) => BTStatus,
): BTNode {
  return {
    id,
    tick(ctx: BTContext) {
      const status = child.tick(ctx);
      return modify(status);
    },
  };
}

export function invert(id: string, child: BTNode): BTNode {
  return decorator(id, child, (s) => {
    if (s === "success") return "failure";
    if (s === "failure") return "success";
    return s;
  });
}

export function succeed(id: string, child: BTNode): BTNode {
  return decorator(id, child, () => "success");
}

export function repeatUntilFail(id: string, child: BTNode): BTNode {
  return {
    id,
    tick(ctx: BTContext) {
      let lastStatus: BTStatus = "success";
      for (let i = 0; i < 5; i++) {
        const status = child.tick(ctx);
        if (status === "failure") return "failure";
        lastStatus = status;
      }
      return lastStatus;
    },
  };
}

export function prioritySelector(id: string, children: BTNode[]): BTNode {
  return {
    id,
    tick(ctx: BTContext) {
      let anyRunning = false;
      for (const child of children) {
        const status = child.tick(ctx);
        if (status === "success") return "success";
        if (status === "running") anyRunning = true;
      }
      return anyRunning ? "running" : "failure";
    },
  };
}
