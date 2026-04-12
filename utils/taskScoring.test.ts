import { describe, it, expect } from 'vitest';
import { computeTaskScore } from './taskScoring';

describe('computeTaskScore', () => {
  it('calcule un score pour une tâche simple', () => {
    const score = computeTaskScore({
      title: 'Sortir la poubelle',
      category: 'cleaning',
      duration: 'very_short',
      physical: 'light',
      frequency: 'daily',
    });

    expect(score.global_score).toBeGreaterThanOrEqual(2);
    expect(score.global_score).toBeLessThanOrEqual(36);
    expect(score.global_label).toBeDefined();
    expect(score.time_score).toBe(1);
    expect(score.physical_score).toBe(1);
  });

  it('donne un score élevé pour une tâche admin enfant', () => {
    const score = computeTaskScore({
      title: 'Inscription école enfant',
      category: 'admin',
      duration: 'long',
      physical: 'none',
      frequency: 'once',
    });

    expect(score.global_score).toBeGreaterThan(20);
    expect(score.mental_load_score).toBeGreaterThan(10);
    expect(score.dominant).toBe('mental');
  });

  it('donne un score bas pour une tâche rapide et simple', () => {
    const score = computeTaskScore({
      title: 'Essuyer la table',
      category: 'cleaning',
      duration: 'very_short',
      physical: 'light',
      frequency: 'once',
    });

    expect(score.global_score).toBeLessThan(12);
  });

  it('détecte les mots-clés enfants', () => {
    const withKeyword = computeTaskScore({
      title: 'Emmener bébé chez le pédiatre',
      category: 'children',
      duration: 'long',
      physical: 'light',
      frequency: 'once',
    });

    const withoutKeyword = computeTaskScore({
      title: 'Faire une tâche',
      category: 'misc',
      duration: 'long',
      physical: 'light',
      frequency: 'once',
    });

    expect(withKeyword.mental_load_score).toBeGreaterThan(withoutKeyword.mental_load_score);
  });

  it('augmente le score avec la fréquence daily', () => {
    const daily = computeTaskScore({
      title: 'Préparer le dîner',
      category: 'meals',
      duration: 'medium',
      physical: 'medium',
      frequency: 'daily',
    });

    const once = computeTaskScore({
      title: 'Préparer le dîner',
      category: 'meals',
      duration: 'medium',
      physical: 'medium',
      frequency: 'once',
    });

    expect(daily.global_score).toBeGreaterThan(once.global_score);
  });

  it('respecte les bornes 2-36', () => {
    const max = computeTaskScore({
      title: 'Gérer inscription école enfant rdv médecin',
      category: 'children',
      duration: 'very_long',
      physical: 'high',
      frequency: 'daily',
    });

    expect(max.global_score).toBeLessThanOrEqual(36);
    expect(max.global_score).toBeGreaterThanOrEqual(2);
  });

  it('le physique pèse moins que le mental', () => {
    const physical = computeTaskScore({
      title: 'Déménager des meubles',
      category: 'misc',
      duration: 'long',
      physical: 'high',
      frequency: 'once',
    });

    const mental = computeTaskScore({
      title: 'Déclarer les impôts',
      category: 'admin',
      duration: 'long',
      physical: 'none',
      frequency: 'once',
    });

    // Admin/mental devrait scorer plus haut que physique pur
    expect(mental.global_score).toBeGreaterThan(physical.global_score);
  });

  it('retourne un label valide', () => {
    const validLabels = ['Légère', 'Modérée', 'Significative', 'Lourde', 'Très lourde'];
    const score = computeTaskScore({
      title: 'Test',
      category: 'misc',
      duration: 'medium',
      physical: 'medium',
      frequency: 'weekly',
    });

    expect(validLabels).toContain(score.global_label);
  });

  it('retourne une dominante valide', () => {
    const validDominants = ['time', 'physical', 'mental', 'impact'];
    const score = computeTaskScore({
      title: 'Test',
      category: 'misc',
      duration: 'medium',
      physical: 'medium',
      frequency: 'weekly',
    });

    expect(validDominants).toContain(score.dominant);
  });
});
