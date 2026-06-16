import ActivityKit
import Foundation

// IMPORTANTE: este archivo está DUPLICADO en targets/widget/HabitoWorkoutAttributes.swift.
// iOS empareja la Live Activity con su widget por el nombre del tipo, así que ambas
// copias deben mantenerse idénticas. Si cambiás una, cambiá la otra.
public struct HabitoWorkoutAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var completed: Int
    public var total: Int

    public init(completed: Int, total: Int) {
      self.completed = completed
      self.total = total
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
