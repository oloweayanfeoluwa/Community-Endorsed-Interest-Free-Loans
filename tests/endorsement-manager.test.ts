import { describe, it, expect, beforeEach } from "vitest";
import { principalCV, stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_STAKE_AMOUNT = 102;
const ERR_SELF_ENDORSEMENT = 104;
const ERR_DUPLICATE_ENDORSEMENT = 105;
const ERR_ENDORSEMENT_NOT_FOUND = 106;
const ERR_INSUFFICIENT_STAKE = 107;
const ERR_INVALID_SCORE_THRESHOLD = 108;
const ERR_INVALID_DECAY_FACTOR = 109;
const ERR_INVALID_MAX_ENDORSERS = 110;
const ERR_INVALID_MIN_ENDORSERS = 111;
const ERR_ENDORSER_LIMIT_REACHED = 112;
const ERR_INVALID_CATEGORY = 114;
const ERR_INVALID_WEIGHT = 115;
const ERR_INVALID_REVOCATION_REASON = 117;
const ERR_REVOCATION_NOT_ALLOWED = 118;
const ERR_INVALID_MAX_STAKE = 121;
const ERR_INVALID_MIN_STAKE = 122;
const ERR_STAKE_LOCK_PERIOD = 123;
const ERR_INVALID_LOCK_PERIOD = 124;
const ERR_ENDORSER_NOT_VERIFIED = 125;
const ERR_INVALID_VERIFICATION_STATUS = 127;

interface Endorsement {
  endorser: string;
  endorsee: string;
  stakeAmount: number;
  timestamp: number;
  category: string;
  weight: number;
  verified: boolean;
  active: boolean;
}

interface Revocation {
  revocationTimestamp: number;
  reason: string;
}

interface Result<T> {
  ok: boolean;
  value: T | number;
}

class EndorsementManagerMock {
  state: {
    adminPrincipal: string;
    nextEndorsementId: number;
    minStakeAmount: number;
    maxStakeAmount: number;
    stakeLockPeriod: number;
    scoreDecayFactor: number;
    minEndorsers: number;
    maxEndorsersPerUser: number;
    scoreThreshold: number;
    verificationRequired: boolean;
    endorsements: Map<number, Endorsement>;
    endorsementsByEndorser: Map<string, number>;
    endorseeEndorsements: Map<string, number[]>;
    endorseeScores: Map<string, number>;
    endorserStakes: Map<string, number>;
    revocationHistory: Map<number, Revocation>;
    userVerificationStatus: Map<string, boolean>;
    contractBalance: number;
  } = this.resetState();
  blockHeight: number = 0;
  caller: string = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
  contractAddress: string = "STCONTRACT";

  private resetState() {
    return {
      adminPrincipal: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      nextEndorsementId: 0,
      minStakeAmount: 100,
      maxStakeAmount: 10000,
      stakeLockPeriod: 144,
      scoreDecayFactor: 95,
      minEndorsers: 3,
      maxEndorsersPerUser: 50,
      scoreThreshold: 500,
      verificationRequired: true,
      endorsements: new Map(),
      endorsementsByEndorser: new Map(),
      endorseeEndorsements: new Map(),
      endorseeScores: new Map(),
      endorserStakes: new Map(),
      revocationHistory: new Map(),
      userVerificationStatus: new Map(),
      contractBalance: 0,
    };
  }

  reset() {
    this.state = this.resetState();
    this.blockHeight = 0;
    this.caller = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    this.state.userVerificationStatus.set(this.caller, true);
  }

  getEndorsement(id: number): Endorsement | undefined {
    return this.state.endorsements.get(id);
  }

  getEndorseeScore(endorsee: string): number {
    return this.state.endorseeScores.get(endorsee) || 0;
  }

  getEndorserStake(endorser: string): number {
    return this.state.endorserStakes.get(endorser) || 0;
  }

  getEndorseeEndorsements(endorsee: string): number[] {
    return this.state.endorseeEndorsements.get(endorsee) || [];
  }

  getRevocationHistory(id: number): Revocation | undefined {
    return this.state.revocationHistory.get(id);
  }

  getUserVerificationStatus(user: string): boolean {
    return this.state.userVerificationStatus.get(user) || false;
  }

  getAdmin(): string {
    return this.state.adminPrincipal;
  }

  getNextEndorsementId(): number {
    return this.state.nextEndorsementId;
  }

  setMinStakeAmount(newMin: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMin <= 0) return { ok: false, value: ERR_INVALID_MIN_STAKE };
    this.state.minStakeAmount = newMin;
    return { ok: true, value: true };
  }

  setMaxStakeAmount(newMax: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= this.state.minStakeAmount) return { ok: false, value: ERR_INVALID_MAX_STAKE };
    this.state.maxStakeAmount = newMax;
    return { ok: true, value: true };
  }

  setStakeLockPeriod(newPeriod: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newPeriod <= 0) return { ok: false, value: ERR_INVALID_LOCK_PERIOD };
    this.state.stakeLockPeriod = newPeriod;
    return { ok: true, value: true };
  }

  setScoreDecayFactor(newFactor: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFactor <= 0 || newFactor > 100) return { ok: false, value: ERR_INVALID_DECAY_FACTOR };
    this.state.scoreDecayFactor = newFactor;
    return { ok: true, value: true };
  }

  setMinEndorsers(newMin: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMin <= 0) return { ok: false, value: ERR_INVALID_MIN_ENDORSERS };
    this.state.minEndorsers = newMin;
    return { ok: true, value: true };
  }

  setMaxEndorsersPerUser(newMax: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= this.state.minEndorsers) return { ok: false, value: ERR_INVALID_MAX_ENDORSERS };
    this.state.maxEndorsersPerUser = newMax;
    return { ok: true, value: true };
  }

  setScoreThreshold(newThreshold: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newThreshold <= 0) return { ok: false, value: ERR_INVALID_SCORE_THRESHOLD };
    this.state.scoreThreshold = newThreshold;
    return { ok: true, value: true };
  }

  setVerificationRequired(required: boolean): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.verificationRequired = required;
    return { ok: true, value: true };
  }

  verifyUser(user: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.userVerificationStatus.set(user, true);
    return { ok: true, value: true };
  }

  endorseUser(
    endorsee: string,
    stakeAmount: number,
    category: string,
    weight: number
  ): Result<number> {
    const id = this.state.nextEndorsementId;
    const key = `${this.caller}-${endorsee}`;
    const currentEndorsements = this.getEndorseeEndorsements(endorsee);

    if (this.caller === endorsee) return { ok: false, value: ERR_SELF_ENDORSEMENT };
    if (stakeAmount < this.state.minStakeAmount || stakeAmount > this.state.maxStakeAmount) return { ok: false, value: ERR_INVALID_STAKE_AMOUNT };
    if (!["community", "professional", "personal"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (weight <= 0 || weight > 100) return { ok: false, value: ERR_INVALID_WEIGHT };
    if (currentEndorsements.length >= this.state.maxEndorsersPerUser) return { ok: false, value: ERR_ENDORSER_LIMIT_REACHED };
    if (this.state.endorsementsByEndorser.has(key)) return { ok: false, value: ERR_DUPLICATE_ENDORSEMENT };
    if (this.state.verificationRequired && !this.getUserVerificationStatus(this.caller)) return { ok: false, value: ERR_ENDORSER_NOT_VERIFIED };

    this.state.contractBalance += stakeAmount;
    const endorsement: Endorsement = {
      endorser: this.caller,
      endorsee,
      stakeAmount,
      timestamp: this.blockHeight,
      category,
      weight,
      verified: false,
      active: true,
    };
    this.state.endorsements.set(id, endorsement);
    this.state.endorsementsByEndorser.set(key, id);
    this.state.endorseeEndorsements.set(endorsee, [...currentEndorsements, id]);
    this.state.endorserStakes.set(this.caller, (this.state.endorserStakes.get(this.caller) || 0) + stakeAmount);
    this.state.nextEndorsementId++;
    const newScore = this.calculateScore(endorsee);
    this.state.endorseeScores.set(endorsee, newScore);
    return { ok: true, value: id };
  }

  private calculateScore(endorsee: string): number {
    const endorsementIds = this.getEndorseeEndorsements(endorsee);
    return endorsementIds.reduce((acc, id) => {
      const endorsement = this.getEndorsement(id);
      if (endorsement && endorsement.active) {
        return acc + endorsement.weight * endorsement.stakeAmount;
      }
      return acc;
    }, 0);
  }

  revokeEndorsement(id: number, reason: string): Result<boolean> {
    const endorsement = this.getEndorsement(id);
    if (!endorsement) return { ok: false, value: ERR_ENDORSEMENT_NOT_FOUND };
    if (endorsement.endorser !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!endorsement.active) return { ok: false, value: ERR_REVOCATION_NOT_ALLOWED };
    if (reason.length === 0) return { ok: false, value: ERR_INVALID_REVOCATION_REASON };
    if (this.blockHeight - endorsement.timestamp < this.state.stakeLockPeriod) return { ok: false, value: ERR_STAKE_LOCK_PERIOD };

    this.state.endorsements.set(id, { ...endorsement, active: false });
    this.state.revocationHistory.set(id, { revocationTimestamp: this.blockHeight, reason });
    this.state.contractBalance -= endorsement.stakeAmount;
    this.state.endorserStakes.set(this.caller, (this.state.endorserStakes.get(this.caller) || 0) - endorsement.stakeAmount);
    const newScore = this.calculateScore(endorsement.endorsee);
    this.state.endorseeScores.set(endorsement.endorsee, newScore);
    return { ok: true, value: true };
  }

  verifyEndorsement(id: number): Result<boolean> {
    const endorsement = this.getEndorsement(id);
    if (!endorsement) return { ok: false, value: ERR_ENDORSEMENT_NOT_FOUND };
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (endorsement.verified) return { ok: false, value: ERR_INVALID_VERIFICATION_STATUS };

    this.state.endorsements.set(id, { ...endorsement, verified: true });
    const newScore = this.calculateScore(endorsement.endorsee);
    this.state.endorseeScores.set(endorsement.endorsee, newScore);
    return { ok: true, value: true };
  }

  updateEndorseeScore(endorsee: string): Result<number> {
    const score = this.calculateScore(endorsee);
    this.state.endorseeScores.set(endorsee, score);
    return { ok: true, value: score };
  }

  withdrawStake(amount: number): Result<boolean> {
    const currentStake = this.getEndorserStake(this.caller);
    if (amount > currentStake) return { ok: false, value: ERR_INSUFFICIENT_STAKE };
    this.state.contractBalance -= amount;
    this.state.endorserStakes.set(this.caller, currentStake - amount);
    return { ok: true, value: true };
  }
}

describe("EndorsementManager", () => {
  let contract: EndorsementManagerMock;

  beforeEach(() => {
    contract = new EndorsementManagerMock();
    contract.reset();
  });

  it("endorses a user successfully", () => {
    const result = contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const endorsement = contract.getEndorsement(0);
    expect(endorsement?.endorser).toBe("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
    expect(endorsement?.endorsee).toBe("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7");
    expect(endorsement?.stakeAmount).toBe(100);
    expect(endorsement?.category).toBe("community");
    expect(endorsement?.weight).toBe(50);
    expect(endorsement?.verified).toBe(false);
    expect(endorsement?.active).toBe(true);
    expect(contract.getEndorseeScore("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7")).toBe(5000);
    expect(contract.getEndorserStake("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")).toBe(100);
    expect(contract.state.contractBalance).toBe(100);
  });

  it("rejects self-endorsement", () => {
    const result = contract.endorseUser("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 100, "community", 50);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_SELF_ENDORSEMENT);
  });

  it("rejects duplicate endorsement", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    const result = contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 200, "professional", 60);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DUPLICATE_ENDORSEMENT);
  });

  it("rejects invalid stake amount", () => {
    const result = contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 50, "community", 50);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STAKE_AMOUNT);
  });

  it("rejects invalid category", () => {
    const result = contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "invalid", 50);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("rejects invalid weight", () => {
    const result = contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_WEIGHT);
  });

  it("rejects unverified endorser when required", () => {
    contract.state.userVerificationStatus.set("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", false);
    const result = contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ENDORSER_NOT_VERIFIED);
  });

  it("allows endorsement when verification not required", () => {
    contract.setVerificationRequired(false);
    contract.state.userVerificationStatus.set("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", false);
    const result = contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    expect(result.ok).toBe(true);
  });

  it("revokes endorsement successfully", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.blockHeight += 144;
    const result = contract.revokeEndorsement(0, "Changed mind");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const endorsement = contract.getEndorsement(0);
    expect(endorsement?.active).toBe(false);
    const revocation = contract.getRevocationHistory(0);
    expect(revocation?.reason).toBe("Changed mind");
    expect(contract.getEndorseeScore("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7")).toBe(0);
    expect(contract.getEndorserStake("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")).toBe(0);
    expect(contract.state.contractBalance).toBe(0);
  });

  it("rejects revocation before lock period", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.blockHeight += 143;
    const result = contract.revokeEndorsement(0, "Changed mind");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_STAKE_LOCK_PERIOD);
  });

  it("rejects revocation by non-endorser", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.caller = "SP3FAKE";
    const result = contract.revokeEndorsement(0, "Changed mind");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid revocation reason", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.blockHeight += 144;
    const result = contract.revokeEndorsement(0, "");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_REVOCATION_REASON);
  });

  it("verifies endorsement successfully", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    const result = contract.verifyEndorsement(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const endorsement = contract.getEndorsement(0);
    expect(endorsement?.verified).toBe(true);
  });

  it("rejects verification by non-admin", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.caller = "SP3FAKE";
    const result = contract.verifyEndorsement(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects already verified endorsement", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.verifyEndorsement(0);
    const result = contract.verifyEndorsement(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_VERIFICATION_STATUS);
  });

  it("updates endorsee score correctly", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.caller = "SP3QBRHQF4BN8HNNB7QT1PL6JEJ83Z3TNR9MUM4JD";
    contract.state.userVerificationStatus.set("SP3QBRHQF4BN8HNNB7QT1PL6JEJ83Z3TNR9MUM4JD", true);
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 200, "professional", 70);
    const result = contract.updateEndorseeScore("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(5000 + 14000);
  });

  it("withdraws stake successfully", () => {
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.blockHeight += 144;
    contract.revokeEndorsement(0, "Changed mind");
    const result = contract.withdrawStake(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("rejects withdrawal exceeding stake", () => {
    const result = contract.withdrawStake(100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_STAKE);
  });

  it("sets min stake amount successfully", () => {
    const result = contract.setMinStakeAmount(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.minStakeAmount).toBe(200);
  });

  it("rejects min stake amount by non-admin", () => {
    contract.caller = "SP3FAKE";
    const result = contract.setMinStakeAmount(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid min stake amount", () => {
    const result = contract.setMinStakeAmount(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MIN_STAKE);
  });

  it("sets max stake amount successfully", () => {
    const result = contract.setMaxStakeAmount(20000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxStakeAmount).toBe(20000);
  });

  it("rejects invalid max stake amount", () => {
    const result = contract.setMaxStakeAmount(50);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MAX_STAKE);
  });

  it("sets stake lock period successfully", () => {
    const result = contract.setStakeLockPeriod(288);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.stakeLockPeriod).toBe(288);
  });

  it("rejects invalid stake lock period", () => {
    const result = contract.setStakeLockPeriod(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_LOCK_PERIOD);
  });

  it("sets score decay factor successfully", () => {
    const result = contract.setScoreDecayFactor(90);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.scoreDecayFactor).toBe(90);
  });

  it("rejects invalid score decay factor", () => {
    const result = contract.setScoreDecayFactor(101);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DECAY_FACTOR);
  });

  it("sets min endorsers successfully", () => {
    const result = contract.setMinEndorsers(5);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.minEndorsers).toBe(5);
  });

  it("rejects invalid min endorsers", () => {
    const result = contract.setMinEndorsers(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MIN_ENDORSERS);
  });

  it("sets max endorsers per user successfully", () => {
    const result = contract.setMaxEndorsersPerUser(100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxEndorsersPerUser).toBe(100);
  });

  it("rejects invalid max endorsers per user", () => {
    const result = contract.setMaxEndorsersPerUser(2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MAX_ENDORSERS);
  });

  it("sets score threshold successfully", () => {
    const result = contract.setScoreThreshold(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.scoreThreshold).toBe(1000);
  });

  it("rejects invalid score threshold", () => {
    const result = contract.setScoreThreshold(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SCORE_THRESHOLD);
  });

  it("sets verification required successfully", () => {
    const result = contract.setVerificationRequired(false);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.verificationRequired).toBe(false);
  });

  it("verifies user successfully", () => {
    const result = contract.verifyUser("SP3QBRHQF4BN8HNNB7QT1PL6JEJ83Z3TNR9MUM4JD");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getUserVerificationStatus("SP3QBRHQF4BN8HNNB7QT1PL6JEJ83Z3TNR9MUM4JD")).toBe(true);
  });

  it("rejects user verification by non-admin", () => {
    contract.caller = "SP3FAKE";
    const result = contract.verifyUser("SP3QBRHQF4BN8HNNB7QT1PL6JEJ83Z3TNR9MUM4JD");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects endorsement when endorser limit reached", () => {
    contract.state.maxEndorsersPerUser = 1;
    contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 100, "community", 50);
    contract.caller = "SP3QBRHQF4BN8HNNB7QT1PL6JEJ83Z3TNR9MUM4JD";
    contract.state.userVerificationStatus.set("SP3QBRHQF4BN8HNNB7QT1PL6JEJ83Z3TNR9MUM4JD", true);
    const result = contract.endorseUser("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", 200, "professional", 60);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ENDORSER_LIMIT_REACHED);
  });
});