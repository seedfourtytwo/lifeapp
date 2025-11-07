/**
 * SettingsScreen
 * Organized settings with collapsible sections
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, ScrollView } from 'react-native';
import { Text, List, IconButton, TextInput, Button, Dialog, Portal, Divider, Checkbox, Switch } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useActivityStore } from '../store/activityStore';
import { Activity, ActivityGoal, Recipe, RecipeIngredient } from '../types';
import * as storage from '../services/storageService';

const AVAILABLE_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
  '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B',
  '#FFC107', '#FF9800', '#FF5722', '#795548', '#607D8B', '#9E9E9E',
];

const AVAILABLE_ICONS = [
  'sleep', 'book-open-variant', 'dumbbell', 'school', 'briefcase', 'meditation',
  'silverware-fork-knife', 'broom', 'dots-horizontal', 'coffee', 'laptop',
  'music', 'run', 'bike', 'walk', 'gamepad-variant', 'television',
  'phone', 'cellphone', 'camera', 'palette', 'hammer', 'cart', 'car', 'airplane',
];

export default function SettingsScreen() {
  const { activities, addActivity, updateActivity, deleteActivity } = useActivityStore();

  // Inline editing state
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityName, setActivityName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);
  const [isNegative, setIsNegative] = useState(false);

  // Goal state
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalHours, setGoalHours] = useState('0');
  const [goalMinutes, setGoalMinutes] = useState('30');
  const [goalPoints, setGoalPoints] = useState('10');
  const [negativePointsPerMinute, setNegativePointsPerMinute] = useState('0.5');

  // Goals storage
  const [goals, setGoals] = useState<ActivityGoal[]>([]);

  // State
  const [activitiesExpanded, setActivitiesExpanded] = useState(true);
  const [recipesExpanded, setRecipesExpanded] = useState(false);

  // Recipe state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeDialogVisible, setRecipeDialogVisible] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [recipeServings, setRecipeServings] = useState('4');
  const [recipeInstructions, setRecipeInstructions] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([
    { item: '', quantity: 0, unit: '' },
  ]);

  // Load goals and recipes on mount
  useEffect(() => {
    loadGoals();
    loadRecipes();
  }, []);

  const loadGoals = async () => {
    const settings = await storage.getUserSettings();
    setGoals(settings.dailyGoals || []);
  };

  const saveGoals = async (updatedGoals: ActivityGoal[]) => {
    const settings = await storage.getUserSettings();
    settings.dailyGoals = updatedGoals;
    await storage.saveUserSettings(settings);
    setGoals(updatedGoals);
  };

  // Activity management functions
  const startAddActivity = () => {
    setEditingActivityId('new');
    setActivityName('');
    setSelectedColor(AVAILABLE_COLORS[0]);
    setSelectedIcon(AVAILABLE_ICONS[0]);
    setIsNegative(false);
    setGoalEnabled(false);
    setGoalHours('0');
    setGoalMinutes('30');
    setGoalPoints('10');
    setNegativePointsPerMinute('0.5');
  };

  const startEditActivity = (activity: Activity) => {
    setEditingActivityId(activity.id);
    setActivityName(activity.name);
    setSelectedColor(activity.color);
    setSelectedIcon(activity.icon);
    setIsNegative(activity.isNegative || false);

    // Load goal from goals array
    const goal = goals.find((g) => g.activityId === activity.id);
    setGoalEnabled(goal?.enabled || false);
    const totalMinutes = goal?.minimumMinutes || 30;
    setGoalHours(Math.floor(totalMinutes / 60).toString());
    setGoalMinutes((totalMinutes % 60).toString());

    // Load point values
    setGoalPoints((activity.goalPoints || 10).toString());
    setNegativePointsPerMinute((activity.negativePointsPerMinute || 0.5).toString());
  };

  const cancelEdit = () => {
    setEditingActivityId(null);
  };

  const handleSave = async () => {
    if (!activityName.trim()) {
      Alert.alert('Error', 'Please enter an activity name');
      return;
    }

    try {
      let activityId: string;
      const isNewActivity = editingActivityId === 'new';

      if (isNewActivity) {
        // Add new activity
        const newActivity = {
          name: activityName.trim(),
          color: selectedColor,
          icon: selectedIcon,
          points: 5,
          order: activities.length,
          isNegative,
          goalPoints: parseInt(goalPoints) || 10,
          negativePointsPerMinute: parseFloat(negativePointsPerMinute) || 0.5,
        };
        await addActivity(newActivity);

        // Get the newly created activity ID
        const updatedActivities = await storage.getActivities();
        const createdActivity = updatedActivities.find((a) => a.name === activityName.trim());
        activityId = createdActivity?.id || '';
      } else {
        // Update existing activity
        activityId = editingActivityId!;
        await updateActivity(activityId, {
          name: activityName.trim(),
          color: selectedColor,
          icon: selectedIcon,
          isNegative,
          goalPoints: parseInt(goalPoints) || 10,
          negativePointsPerMinute: parseFloat(negativePointsPerMinute) || 0.5,
        });
      }

      // Save goal
      if (activityId) {
        const totalMinutes = (parseInt(goalHours) || 0) * 60 + (parseInt(goalMinutes) || 0);
        const existingIndex = goals.findIndex((g) => g.activityId === activityId);

        let updatedGoals: ActivityGoal[];
        if (existingIndex >= 0) {
          updatedGoals = [...goals];
          updatedGoals[existingIndex] = {
            activityId,
            activityName: activityName.trim(),
            minimumMinutes: totalMinutes,
            enabled: goalEnabled,
          };
        } else {
          updatedGoals = [
            ...goals,
            {
              activityId,
              activityName: activityName.trim(),
              minimumMinutes: totalMinutes,
              enabled: goalEnabled,
            },
          ];
        }

        await saveGoals(updatedGoals);
      }

      setEditingActivityId(null);
      setActivityName('');
    } catch (error) {
      console.error('Failed to save activity:', error);
      Alert.alert('Error', 'Failed to save activity. Please try again.');
    }
  };

  const handleMoveUp = async (activity: Activity) => {
    const sorted = [...activities].sort((a, b) => a.order - b.order);
    const currentIndex = sorted.findIndex((a) => a.id === activity.id);

    if (currentIndex > 0) {
      const previousActivity = sorted[currentIndex - 1];
      await updateActivity(activity.id, { order: previousActivity.order });
      await updateActivity(previousActivity.id, { order: activity.order });
    }
  };

  const handleMoveDown = async (activity: Activity) => {
    const sorted = [...activities].sort((a, b) => a.order - b.order);
    const currentIndex = sorted.findIndex((a) => a.id === activity.id);

    if (currentIndex < sorted.length - 1) {
      const nextActivity = sorted[currentIndex + 1];
      await updateActivity(activity.id, { order: nextActivity.order });
      await updateActivity(nextActivity.id, { order: activity.order });
    }
  };

  const handleDelete = (activity: Activity) => {
    Alert.alert('Delete Activity', `Are you sure you want to delete "${activity.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteActivity(activity.id);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete activity');
          }
        },
      },
    ]);
  };

  // Recipe management functions
  const loadRecipes = async () => {
    const loadedRecipes = await storage.getRecipes();
    setRecipes(loadedRecipes);
  };

  const openAddRecipeDialog = () => {
    setEditingRecipe(null);
    setRecipeName('');
    setRecipeServings('4');
    setRecipeInstructions('');
    setRecipeIngredients([{ item: '', quantity: 0, unit: '' }]);
    setRecipeDialogVisible(true);
  };

  const openEditRecipeDialog = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setRecipeName(recipe.name);
    setRecipeServings(recipe.servings.toString());
    setRecipeInstructions(recipe.instructions);
    setRecipeIngredients(recipe.ingredients.length > 0 ? recipe.ingredients : [{ item: '', quantity: 0, unit: '' }]);
    setRecipeDialogVisible(true);
  };

  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) {
      Alert.alert('Error', 'Please enter a recipe name');
      return;
    }

    // Filter out empty ingredients
    const validIngredients = recipeIngredients.filter((ing) => ing.item.trim() !== '');

    try {
      if (editingRecipe) {
        await storage.updateRecipe(editingRecipe.id, {
          name: recipeName.trim(),
          servings: parseInt(recipeServings) || 4,
          instructions: recipeInstructions.trim(),
          ingredients: validIngredients,
        });
      } else {
        const newRecipe: Recipe = {
          id: Date.now().toString(),
          name: recipeName.trim(),
          servings: parseInt(recipeServings) || 4,
          instructions: recipeInstructions.trim(),
          ingredients: validIngredients,
          createdAt: new Date().toISOString(),
        };
        await storage.addRecipe(newRecipe);
      }

      await loadRecipes();
      setRecipeDialogVisible(false);
    } catch (error) {
      console.error('Failed to save recipe:', error);
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    }
  };

  const handleDeleteRecipe = (recipe: Recipe) => {
    Alert.alert('Delete Recipe', `Are you sure you want to delete "${recipe.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await storage.deleteRecipe(recipe.id);
            await loadRecipes();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete recipe');
          }
        },
      },
    ]);
  };

  const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: string) => {
    const updated = [...recipeIngredients];
    if (field === 'quantity') {
      updated[index][field] = parseFloat(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setRecipeIngredients(updated);
  };

  const addIngredient = () => {
    setRecipeIngredients([...recipeIngredients, { item: '', quantity: 0, unit: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (recipeIngredients.length > 1) {
      setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Activities Section */}
        <List.Accordion
          title="Manage Activities"
          description={`${activities.length} activities (first 15 shown on Life screen)`}
          left={(_props) => <List.Icon {..._props} icon="format-list-bulleted" />}
          expanded={activitiesExpanded}
          onPress={() => setActivitiesExpanded(!activitiesExpanded)}
          style={styles.accordion}
        >
          <View style={styles.sectionContent}>
            <Text variant="bodyMedium" style={styles.sectionDescription}>
              Tap edit to configure. First 15 activities appear on the Life screen.
            </Text>
            {activities.sort((a, b) => a.order - b.order).map((item, index) => {
              const isEditing = editingActivityId === item.id;
              return (
                <View key={item.id}>
                  <List.Item
                    title={item.name}
                    description={item.isNegative ? 'Negative activity (reduces score)' : undefined}
                    left={(_props) => <List.Icon {..._props} icon={item.icon as keyof typeof Icon.glyphMap} color={item.color} />}
                    right={(_props) => (
                      <View style={styles.actionsContainer}>
                        {!isEditing && (
                          <>
                            <IconButton
                              icon="chevron-up"
                              size={20}
                              onPress={() => handleMoveUp(item)}
                              disabled={index === 0}
                            />
                            <IconButton
                              icon="chevron-down"
                              size={20}
                              onPress={() => handleMoveDown(item)}
                              disabled={index === activities.length - 1}
                            />
                            <IconButton icon="pencil" size={20} onPress={() => startEditActivity(item)} />
                            <IconButton icon="delete" size={20} onPress={() => handleDelete(item)} />
                          </>
                        )}
                      </View>
                    )}
                    style={[
                      styles.listItem,
                      index < 15 && styles.topVisibleItem,
                      item.isNegative && styles.negativeItem,
                    ]}
                  />

                  {/* Inline Edit Form */}
                  {isEditing && (
                    <View style={styles.editForm}>
                      <TextInput
                        label="Activity Name"
                        value={activityName}
                        onChangeText={setActivityName}
                        mode="outlined"
                        style={styles.input}
                      />

                      <Text variant="labelLarge" style={styles.sectionLabel}>
                        Color
                      </Text>
                      <View style={styles.colorGrid}>
                        {AVAILABLE_COLORS.map((color) => (
                          <IconButton
                            key={color}
                            icon={selectedColor === color ? 'check-circle' : 'circle'}
                            iconColor={color}
                            size={32}
                            onPress={() => setSelectedColor(color)}
                            style={selectedColor === color ? styles.selectedColor : undefined}
                          />
                        ))}
                      </View>

                      <Text variant="labelLarge" style={styles.sectionLabel}>
                        Icon
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.iconGrid}>
                          {AVAILABLE_ICONS.map((icon) => (
                            <IconButton
                              key={icon}
                              icon={icon}
                              iconColor={selectedIcon === icon ? selectedColor : '#666'}
                              size={28}
                              onPress={() => setSelectedIcon(icon)}
                              style={selectedIcon === icon ? styles.selectedIcon : undefined}
                            />
                          ))}
                        </View>
                      </ScrollView>

                      <View style={styles.checkboxRow}>
                        <Checkbox.Item
                          label="Negative Activity (reduces daily score)"
                          status={isNegative ? 'checked' : 'unchecked'}
                          onPress={() => setIsNegative(!isNegative)}
                          labelStyle={styles.checkboxLabel}
                        />
                      </View>

                      <Divider style={styles.divider} />

                      <Text variant="labelLarge" style={styles.sectionLabel}>
                        Daily Goal
                      </Text>
                      <View style={styles.goalContainer}>
                        <View style={styles.goalInputs}>
                          <TextInput
                            label="Hours"
                            value={goalHours}
                            onChangeText={setGoalHours}
                            keyboardType="number-pad"
                            mode="outlined"
                            style={styles.goalInput}
                            disabled={!goalEnabled}
                            dense
                          />
                          <TextInput
                            label="Minutes"
                            value={goalMinutes}
                            onChangeText={setGoalMinutes}
                            keyboardType="number-pad"
                            mode="outlined"
                            style={styles.goalInput}
                            disabled={!goalEnabled}
                            dense
                          />
                        </View>
                        <View style={styles.goalToggle}>
                          <Text variant="bodyMedium">Enable goal</Text>
                          <Switch value={goalEnabled} onValueChange={setGoalEnabled} />
                        </View>
                      </View>

                      <Divider style={styles.divider} />

                      <Text variant="labelLarge" style={styles.sectionLabel}>
                        Points Configuration
                      </Text>

                      {!isNegative && (
                        <TextInput
                          label="Points Earned When Goal Met"
                          value={goalPoints}
                          onChangeText={setGoalPoints}
                          keyboardType="number-pad"
                          mode="outlined"
                          style={styles.input}
                          disabled={!goalEnabled}
                          dense
                          placeholder="10"
                        />
                      )}

                      {isNegative && (
                        <TextInput
                          label="Points Deducted Per Minute"
                          value={negativePointsPerMinute}
                          onChangeText={setNegativePointsPerMinute}
                          keyboardType="decimal-pad"
                          mode="outlined"
                          style={styles.input}
                          dense
                          placeholder="0.5"
                        />
                      )}

                      <View style={styles.editActions}>
                        <Button mode="outlined" onPress={cancelEdit}>
                          Cancel
                        </Button>
                        <Button mode="contained" onPress={handleSave}>
                          Save
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Add New Activity Form */}
            {editingActivityId === 'new' ? (
              <View style={styles.editForm}>
                <TextInput
                  label="Activity Name"
                  value={activityName}
                  onChangeText={setActivityName}
                  mode="outlined"
                  style={styles.input}
                />

                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Color
                </Text>
                <View style={styles.colorGrid}>
                  {AVAILABLE_COLORS.map((color) => (
                    <IconButton
                      key={color}
                      icon={selectedColor === color ? 'check-circle' : 'circle'}
                      iconColor={color}
                      size={32}
                      onPress={() => setSelectedColor(color)}
                      style={selectedColor === color ? styles.selectedColor : undefined}
                    />
                  ))}
                </View>

                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Icon
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.iconGrid}>
                    {AVAILABLE_ICONS.map((icon) => (
                      <IconButton
                        key={icon}
                        icon={icon}
                        iconColor={selectedIcon === icon ? selectedColor : '#666'}
                        size={28}
                        onPress={() => setSelectedIcon(icon)}
                        style={selectedIcon === icon ? styles.selectedIcon : undefined}
                      />
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.checkboxRow}>
                  <Checkbox.Item
                    label="Negative Activity (reduces daily score)"
                    status={isNegative ? 'checked' : 'unchecked'}
                    onPress={() => setIsNegative(!isNegative)}
                    labelStyle={styles.checkboxLabel}
                  />
                </View>

                <Divider style={styles.divider} />

                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Daily Goal
                </Text>
                <View style={styles.goalContainer}>
                  <View style={styles.goalInputs}>
                    <TextInput
                      label="Hours"
                      value={goalHours}
                      onChangeText={setGoalHours}
                      keyboardType="number-pad"
                      mode="outlined"
                      style={styles.goalInput}
                      disabled={!goalEnabled}
                      dense
                    />
                    <TextInput
                      label="Minutes"
                      value={goalMinutes}
                      onChangeText={setGoalMinutes}
                      keyboardType="number-pad"
                      mode="outlined"
                      style={styles.goalInput}
                      disabled={!goalEnabled}
                      dense
                    />
                  </View>
                  <View style={styles.goalToggle}>
                    <Text variant="bodyMedium">Enable goal</Text>
                    <Switch value={goalEnabled} onValueChange={setGoalEnabled} />
                  </View>
                </View>

                <Divider style={styles.divider} />

                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Points Configuration
                </Text>

                {!isNegative && (
                  <TextInput
                    label="Points Earned When Goal Met"
                    value={goalPoints}
                    onChangeText={setGoalPoints}
                    keyboardType="number-pad"
                    mode="outlined"
                    style={styles.input}
                    disabled={!goalEnabled}
                    dense
                    placeholder="10"
                  />
                )}

                {isNegative && (
                  <TextInput
                    label="Points Deducted Per Minute"
                    value={negativePointsPerMinute}
                    onChangeText={setNegativePointsPerMinute}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    style={styles.input}
                    dense
                    placeholder="0.5"
                  />
                )}

                <View style={styles.editActions}>
                  <Button mode="outlined" onPress={cancelEdit}>
                    Cancel
                  </Button>
                  <Button mode="contained" onPress={handleSave}>
                    Save
                  </Button>
                </View>
              </View>
            ) : (
              <Button
                mode="outlined"
                icon="plus"
                onPress={startAddActivity}
                style={styles.addButton}
              >
                Add Activity
              </Button>
            )}
          </View>
        </List.Accordion>

        <Divider />

        {/* Recipe Library Section */}
        <List.Accordion
          title="Recipe Library"
          description={`${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`}
                  left={(_props) => <List.Icon {..._props} icon="silverware-fork-knife" />}
          expanded={recipesExpanded}
          onPress={() => setRecipesExpanded(!recipesExpanded)}
          style={styles.accordion}
        >
          <View style={styles.sectionContent}>
            <Text variant="bodyMedium" style={styles.sectionDescription}>
              Create and manage your cooking recipes with ingredients and instructions.
            </Text>
            {recipes.length === 0 ? (
              <View style={styles.emptyRecipes}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No recipes yet
                </Text>
              </View>
            ) : (
              recipes.map((recipe) => (
                <List.Item
                  key={recipe.id}
                  title={recipe.name}
                  description={`${recipe.servings} servings • ${recipe.ingredients.length} ingredients`}
                  left={(_props) => <List.Icon {..._props} icon="chef-hat" />}
                  right={(_props) => (
                    <View style={styles.actionsContainer}>
                      <IconButton icon="pencil" size={20} onPress={() => openEditRecipeDialog(recipe)} />
                      <IconButton icon="delete" size={20} onPress={() => handleDeleteRecipe(recipe)} />
                    </View>
                  )}
                  style={styles.listItem}
                />
              ))
            )}
            <Button
              mode="outlined"
              icon="plus"
              onPress={openAddRecipeDialog}
              style={styles.addButton}
            >
              Add Recipe
            </Button>
          </View>
        </List.Accordion>

        <Divider />
      </ScrollView>

      {/* Recipe Dialog */}
      <Portal>
        {/* Add/Edit Recipe Dialog */}
        <Dialog
          visible={recipeDialogVisible}
          onDismiss={() => setRecipeDialogVisible(false)}
          style={styles.recipeDialog}
        >
          <Dialog.Title>{editingRecipe ? 'Edit Recipe' : 'Add Recipe'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.recipeDialogContent}>
              <TextInput
                label="Recipe Name"
                value={recipeName}
                onChangeText={setRecipeName}
                mode="outlined"
                style={styles.input}
              />

              <TextInput
                label="Servings"
                value={recipeServings}
                onChangeText={setRecipeServings}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.input}
              />

              <Text variant="labelLarge" style={styles.sectionLabel}>
                Ingredients
              </Text>
              {recipeIngredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientRow}>
                  <TextInput
                    label="Item"
                    value={ingredient.item}
                    onChangeText={(value) => handleIngredientChange(index, 'item', value)}
                    mode="outlined"
                    style={styles.ingredientItem}
                  />
                  <TextInput
                    label="Qty"
                    value={ingredient.quantity.toString()}
                    onChangeText={(value) => handleIngredientChange(index, 'quantity', value)}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    style={styles.ingredientQty}
                  />
                  <TextInput
                    label="Unit"
                    value={ingredient.unit}
                    onChangeText={(value) => handleIngredientChange(index, 'unit', value)}
                    mode="outlined"
                    style={styles.ingredientUnit}
                  />
                  {recipeIngredients.length > 1 && (
                    <IconButton
                      icon="close"
                      size={20}
                      onPress={() => removeIngredient(index)}
                      style={styles.removeIngredient}
                    />
                  )}
                </View>
              ))}
              <Button
                mode="text"
                icon="plus"
                onPress={addIngredient}
                style={styles.addIngredientButton}
              >
                Add Ingredient
              </Button>

              <TextInput
                label="Instructions"
                value={recipeInstructions}
                onChangeText={setRecipeInstructions}
                mode="outlined"
                multiline
                numberOfLines={4}
                style={styles.instructionsInput}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setRecipeDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveRecipe}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  accordion: {
    backgroundColor: '#FFFFFF',
  },
  sectionContent: {
    backgroundColor: '#FAFAFA',
    paddingBottom: 16,
  },
  sectionDescription: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#666',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
  },
  topVisibleItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  negativeItem: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF5252',
  },
  addButton: {
    margin: 16,
  },
  editForm: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 8,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  input: {
    marginBottom: 16,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  selectedColor: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectedIcon: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  checkboxRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  divider: {
    marginVertical: 16,
  },
  goalContainer: {
    marginBottom: 8,
  },
  goalInputs: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  goalInput: {
    flex: 1,
  },
  goalToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyRecipes: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
  },
  recipeDialog: {
    maxHeight: '90%',
  },
  recipeDialogContent: {
    paddingHorizontal: 24,
    maxHeight: 500,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  ingredientItem: {
    flex: 2,
  },
  ingredientQty: {
    flex: 1,
  },
  ingredientUnit: {
    flex: 1,
  },
  removeIngredient: {
    margin: 0,
  },
  addIngredientButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  instructionsInput: {
    marginBottom: 16,
  },
});
