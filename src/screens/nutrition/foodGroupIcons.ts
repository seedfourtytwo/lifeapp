import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { FoodGroup } from '../../protocol';

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const FOOD_GROUP_ICONS: Record<FoodGroup, MaterialCommunityIconName> = {
  vegetable: 'carrot',
  fruit: 'food-apple',
  legume: 'sprout',
  grain: 'barley',
  nut: 'peanut',
  seed: 'seed',
  herbSpice: 'leaf',
  mushroom: 'mushroom',
  animal: 'food-drumstick',
  dairy: 'cheese',
  other: 'silverware-fork-knife',
};
