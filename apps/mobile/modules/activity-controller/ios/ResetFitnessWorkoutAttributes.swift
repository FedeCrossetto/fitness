import ActivityKit
import Foundation

// IMPORTANTE: este archivo está DUPLICADO en targets/widget/ResetFitnessWorkoutAttributes.swift.
// iOS empareja la Live Activity con su widget por el nombre del tipo, así que ambas
// copias deben mantenerse idénticas. Si cambiás una, cambiá la otra.
public struct ResetFitnessWorkoutAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var completed: Int
    public var total: Int
    public var exerciseName: String
    public var currentSet: Int
    public var exerciseSetCount: Int
    public var weightKg: Double?
    public var reps: Int?

    public init(
      completed: Int,
      total: Int,
      exerciseName: String,
      currentSet: Int,
      exerciseSetCount: Int,
      weightKg: Double?,
      reps: Int?
    ) {
      self.completed = completed
      self.total = total
      self.exerciseName = exerciseName
      self.currentSet = currentSet
      self.exerciseSetCount = exerciseSetCount
      self.weightKg = weightKg
      self.reps = reps
    }
  }

  /// Datos estáticos de la sesión (no cambian mientras dura).
  public var workoutTitle: String
  /// epoch en segundos: el widget arma el timer a partir de acá.
  public var startedAt: Double

  public init(workoutTitle: String, startedAt: Double) {
    self.workoutTitle = workoutTitle
    self.startedAt = startedAt
  }
}
