import ActivityKit
import Foundation

// IMPORTANTE: copia EXACTA de
// modules/activity-controller/ios/ResetFitnessWorkoutAttributes.swift.
// iOS empareja la Live Activity con este widget por el nombre del tipo, así que
// ambas copias deben quedar idénticas. Si cambiás una, cambiá la otra.
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

  public var workoutTitle: String
  public var startedAt: Double

  public init(workoutTitle: String, startedAt: Double) {
    self.workoutTitle = workoutTitle
    self.startedAt = startedAt
  }
}
