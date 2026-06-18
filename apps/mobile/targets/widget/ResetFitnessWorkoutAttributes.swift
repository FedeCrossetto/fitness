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

    public init(completed: Int, total: Int) {
      self.completed = completed
      self.total = total
    }
  }

  public var workoutTitle: String
  public var startedAt: Double

  public init(workoutTitle: String, startedAt: Double) {
    self.workoutTitle = workoutTitle
    self.startedAt = startedAt
  }
}
