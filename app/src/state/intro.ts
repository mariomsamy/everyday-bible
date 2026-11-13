import { create } from 'zustand';
import { getItem, setItem } from '../storage';
import { track } from '../analytics';

/** The initial intro (sign in or skip, and the presentation screens) shows only once. */
const KEY = 'ob:intro';

// Without storage the intro does not show, to avoid repeating on every visit.
const seen = () => getItem(KEY, '1') === '1';

/** True once the intro screens were on display. People who already had a Bible never see them and are not counted as finishing. */
let viewed = false;
export const markIntroViewed = () => {
  viewed = true;
};

interface IntroStore {
  done: boolean;
  finish: () => void;
}

export const useIntro = create<IntroStore>((set) => ({
  done: seen(),
  finish: () => {
    if (viewed) track('intro_done');
    setItem(KEY, '1');
    set({ done: true });
  },
}));
