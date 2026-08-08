export interface FermentationProfile {
  id: string;
  name: string;
  guidance: string;
  instructions: string;
}

export interface TrashedProfile extends FermentationProfile {
  deletedAt: number;
}

export interface ProfileState {
  profiles: FermentationProfile[];
  trash: TrashedProfile[];
}

const recoveryPeriodMs = 7 * 24 * 60 * 60 * 1000;

const starterProfiles: FermentationProfile[] = [
  {
    id: "starter-kombucha-f1",
    name: "Kombucha F1",
    guidance: "Keep at room temperature and cover with a breathable cloth.",
    instructions: "Taste after 7 days, then bottle when pleasantly tart.",
  },
  {
    id: "starter-kombucha-f2",
    name: "Kombucha F2",
    guidance: "Use pressure-safe bottles and leave room for carbonation.",
    instructions: "Bottle strained kombucha with flavoring, then burp daily.",
  },
  {
    id: "starter-sauerkraut",
    name: "Sauerkraut",
    guidance: "Use 2% salt by cabbage weight and keep cabbage below brine.",
    instructions: "Pack tightly, weight the cabbage, and taste after 7 days.",
  },
  {
    id: "starter-anaerobic",
    name: "Anaerobic fermentation",
    guidance: "Keep ingredients submerged and the airlock filled.",
    instructions: "Check the seal and airlock daily during active fermentation.",
  },
  {
    id: "starter-sourdough",
    name: "Sourdough",
    guidance: "Keep the starter loosely covered at room temperature.",
    instructions: "Feed equal weights flour and water; use when doubled and bubbly.",
  },
];

export function createProfileState(): ProfileState {
  return { profiles: starterProfiles.map((profile) => ({ ...profile })), trash: [] };
}

export function addProfile(
  state: ProfileState,
  profile: FermentationProfile,
): ProfileState {
  return { ...state, profiles: [...state.profiles, profile] };
}

export function updateProfile(
  state: ProfileState,
  profile: FermentationProfile,
): ProfileState {
  const index = state.profiles.findIndex(({ id }) => id === profile.id);

  if (index === -1) {
    return state;
  }

  const profiles = [...state.profiles];
  profiles[index] = profile;
  return { ...state, profiles };
}

export function deleteProfile(
  state: ProfileState,
  id: string,
  deletedAt: number,
): ProfileState {
  const current = discardExpiredProfiles(state, deletedAt);
  const profile = current.profiles.find((candidate) => candidate.id === id);

  if (!profile) {
    return current;
  }

  return {
    profiles: current.profiles.filter((candidate) => candidate.id !== id),
    trash: [...current.trash, { ...profile, deletedAt }],
  };
}

export function restoreProfile(
  state: ProfileState,
  id: string,
  now: number,
): ProfileState {
  const profile = state.trash.find((candidate) => candidate.id === id);

  if (!profile || now - profile.deletedAt >= recoveryPeriodMs) {
    return discardExpiredProfiles(state, now);
  }

  const { deletedAt: _deletedAt, ...restored } = profile;
  return {
    profiles: state.profiles.some((candidate) => candidate.id === id)
      ? state.profiles
      : [...state.profiles, restored],
    trash: state.trash.filter((candidate) => candidate.id !== id),
  };
}

export function discardExpiredProfiles(state: ProfileState, now: number): ProfileState {
  const trash = state.trash.filter(
    (profile) => now - profile.deletedAt < recoveryPeriodMs,
  );

  return trash.length === state.trash.length ? state : { ...state, trash };
}
