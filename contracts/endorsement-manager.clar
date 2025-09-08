(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-ENDORSEE u101)
(define-constant ERR-INVALID-STAKE-AMOUNT u102)
(define-constant ERR-INVALID-ENDORSER u103)
(define-constant ERR-SELF-ENDORSEMENT u104)
(define-constant ERR-DUPLICATE-ENDORSEMENT u105)
(define-constant ERR-ENDORSEMENT-NOT-FOUND u106)
(define-constant ERR-INSUFFICIENT-STAKE u107)
(define-constant ERR-INVALID-SCORE-THRESHOLD u108)
(define-constant ERR-INVALID-DECAY-FACTOR u109)
(define-constant ERR-INVALID-MAX-ENDORSERS u110)
(define-constant ERR-INVALID-MIN-ENDORSERS u111)
(define-constant ERR-ENDORSER-LIMIT-REACHED u112)
(define-constant ERR-INVALID-TIMESTAMP u113)
(define-constant ERR-INVALID-CATEGORY u114)
(define-constant ERR-INVALID-WEIGHT u115)
(define-constant ERR-SCORE-CALCULATION-FAILED u116)
(define-constant ERR-INVALID-REVOCATION-REASON u117)
(define-constant ERR-REVOCATION-NOT-ALLOWED u118)
(define-constant ERR-INVALID-ADMIN u119)
(define-constant ERR-PARAM-UPDATE-NOT-ALLOWED u120)
(define-constant ERR-INVALID-MAX-STAKE u121)
(define-constant ERR-INVALID-MIN-STAKE u122)
(define-constant ERR-STAKE-LOCK-PERIOD u123)
(define-constant ERR-INVALID-LOCK-PERIOD u124)
(define-constant ERR-ENDORSER-NOT-VERIFIED u125)
(define-constant ERR-ENDORSEE-NOT-REGISTERED u126)
(define-constant ERR-INVALID-VERIFICATION-STATUS u127)
(define-constant ERR-MAX-ENDORSERS-EXCEEDED u128)
(define-constant ERR-INVALID-DEPOSIT u129)
(define-constant ERR-WITHDRAWAL-NOT-ALLOWED u130)

(define-data-var admin-principal principal tx-sender)
(define-data-var next-endorsement-id uint u0)
(define-data-var min-stake-amount uint u100)
(define-data-var max-stake-amount uint u10000)
(define-data-var stake-lock-period uint u144)
(define-data-var score-decay-factor uint u95)
(define-data-var min-endorsers uint u3)
(define-data-var max-endorsers-per-user uint u50)
(define-data-var score-threshold uint u500)
(define-data-var verification-required bool true)

(define-map endorsements
  uint
  {
    endorser: principal,
    endorsee: principal,
    stake-amount: uint,
    timestamp: uint,
    category: (string-utf8 50),
    weight: uint,
    verified: bool,
    active: bool
  }
)

(define-map endorsements-by-endorser
  { endorser: principal, endorsee: principal }
  uint
)

(define-map endorsee-endorsements
  principal
  (list 50 uint)
)

(define-map endorsee-scores
  principal
  uint
)

(define-map endorser-stakes
  principal
  uint
)

(define-map revocation-history
  uint
  {
    revocation-timestamp: uint,
    reason: (string-utf8 200)
  }
)

(define-map user-verification-status
  principal
  bool
)

(define-read-only (get-endorsement (id uint))
  (map-get? endorsements id)
)

(define-read-only (get-endorsee-score (endorsee principal))
  (default-to u0 (map-get? endorsee-scores endorsee))
)

(define-read-only (get-endorser-stake (endorser principal))
  (default-to u0 (map-get? endorser-stakes endorser))
)

(define-read-only (get-endorsee-endorsements (endorsee principal))
  (default-to (list) (map-get? endorsee-endorsements endorsee))
)

(define-read-only (get-revocation-history (id uint))
  (map-get? revocation-history id)
)

(define-read-only (get-user-verification-status (user principal))
  (default-to false (map-get? user-verification-status user))
)

(define-read-only (get-admin)
  (var-get admin-principal)
)

(define-read-only (get-next-endorsement-id)
  (var-get next-endorsement-id)
)

(define-private (validate-principal (p principal))
  (ok (not (is-eq p tx-sender)))
)

(define-private (validate-stake-amount (amount uint))
  (if (and (>= amount (var-get min-stake-amount)) (<= amount (var-get max-stake-amount)))
      (ok true)
      (err ERR-INVALID-STAKE-AMOUNT))
)

(define-private (validate-category (cat (string-utf8 50)))
  (if (or (is-eq cat u"community") (is-eq cat u"professional") (is-eq cat u"personal"))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-weight (w uint))
  (if (and (> w u0) (<= w u100))
      (ok true)
      (err ERR-INVALID-WEIGHT))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-revocation-reason (reason (string-utf8 200)))
  (if (> (len reason) u0)
      (ok true)
      (err ERR-INVALID-REVOCATION-REASON))
)

(define-private (validate-lock-period (period uint))
  (if (> period u0)
      (ok true)
      (err ERR-INVALID-LOCK-PERIOD))
)

(define-private (is-admin (caller principal))
  (is-eq caller (var-get admin-principal))
)

(define-private (is-verified (user principal))
  (get-user-verification-status user)
)

(define-private (calculate-score (endorsee principal))
  (let (
        (endorsement-ids (get-endorsee-endorsements endorsee))
        (current-score (fold sum-weights endorsement-ids u0))
      )
    (map-set endorsee-scores endorsee current-score)
    current-score
  )
)

(define-private (sum-weights (id uint) (acc uint))
  (match (get-endorsement id)
    endorsement
      (if (get active endorsement)
          (+ acc (* (get weight endorsement) (get stake-amount endorsement)))
          acc)
    acc)
)

(define-public (set-min-stake-amount (new-min uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-min u0) (err ERR-INVALID-MIN-STAKE))
    (var-set min-stake-amount new-min)
    (ok true)
  )
)

(define-public (set-max-stake-amount (new-max uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max (var-get min-stake-amount)) (err ERR-INVALID-MAX-STAKE))
    (var-set max-stake-amount new-max)
    (ok true)
  )
)

(define-public (set-stake-lock-period (new-period uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-lock-period new-period))
    (var-set stake-lock-period new-period)
    (ok true)
  )
)

(define-public (set-score-decay-factor (new-factor uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (and (> new-factor u0) (<= new-factor u100)) (err ERR-INVALID-DECAY-FACTOR))
    (var-set score-decay-factor new-factor)
    (ok true)
  )
)

(define-public (set-min-endorsers (new-min uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-min u0) (err ERR-INVALID-MIN-ENDORSERS))
    (var-set min-endorsers new-min)
    (ok true)
  )
)

(define-public (set-max-endorsers-per-user (new-max uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max (var-get min-endorsers)) (err ERR-INVALID-MAX-ENDORSERS))
    (var-set max-endorsers-per-user new-max)
    (ok true)
  )
)

(define-public (set-score-threshold (new-threshold uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-threshold u0) (err ERR-INVALID-SCORE-THRESHOLD))
    (var-set score-threshold new-threshold)
    (ok true)
  )
)

(define-public (set-verification-required (required bool))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set verification-required required)
    (ok true)
  )
)

(define-public (verify-user (user principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (map-set user-verification-status user true)
    (ok true)
  )
)

(define-public (endorse-user
  (endorsee principal)
  (stake-amount uint)
  (category (string-utf8 50))
  (weight uint)
)
  (let (
        (id (var-get next-endorsement-id))
        (key {endorser: tx-sender, endorsee: endorsee})
        (current-endorsements (get-endorsee-endorsements endorsee))
      )
    (asserts! (not (is-eq tx-sender endorsee)) (err ERR-SELF-ENDORSEMENT))
    (try! (validate-principal endorsee))
    (try! (validate-stake-amount stake-amount))
    (try! (validate-category category))
    (try! (validate-weight weight))
    (asserts! (is-none (map-get? endorsements-by-endorser key)) (err ERR-DUPLICATE-ENDORSEMENT))
    (asserts! (>= (as-contract (stx-get-balance tx-sender)) stake-amount) (err ERR-INSUFFICIENT-STAKE))
    (asserts! (<= (len current-endorsements) (var-get max-endorsers-per-user)) (err ERR-ENDORSER-LIMIT-REACHED))
    (if (var-get verification-required)
        (asserts! (is-verified tx-sender) (err ERR-ENDORSER-NOT-VERIFIED))
        true
    )
    (try! (stx-transfer? stake-amount tx-sender (as-contract tx-sender)))
    (map-set endorsements id
      {
        endorser: tx-sender,
        endorsee: endorsee,
        stake-amount: stake-amount,
        timestamp: block-height,
        category: category,
        weight: weight,
        verified: false,
        active: true
      }
    )
    (map-set endorsements-by-endorser key id)
    (map-set endorsee-endorsements endorsee (append current-endorsements id))
    (map-set endorser-stakes tx-sender (+ (get-endorser-stake tx-sender) stake-amount))
    (var-set next-endorsement-id (+ id u1))
    (let ((new-score (calculate-score endorsee)))
      (print { event: "endorsement-created", id: id, score: new-score })
    )
    (ok id)
  )
)

(define-public (revoke-endorsement (id uint) (reason (string-utf8 200)))
  (match (get-endorsement id)
    endorsement
      (begin
        (asserts! (is-eq (get endorser endorsement) tx-sender) (err ERR-NOT-AUTHORIZED))
        (asserts! (get active endorsement) (err ERR-REVOCATION-NOT-ALLOWED))
        (try! (validate-revocation-reason reason))
        (asserts! (>= (- block-height (get timestamp endorsement)) (var-get stake-lock-period)) (err ERR-STAKE-LOCK-PERIOD))
        (map-set endorsements id (merge endorsement { active: false }))
        (map-set revocation-history id { revocation-timestamp: block-height, reason: reason })
        (try! (as-contract (stx-transfer? (get stake-amount endorsement) tx-sender (get endorser endorsement))))
        (map-set endorser-stakes tx-sender (- (get-endorser-stake tx-sender) (get stake-amount endorsement)))
        (let ((new-score (calculate-score (get endorsee endorsement))))
          (print { event: "endorsement-revoked", id: id, score: new-score })
        )
        (ok true)
      )
    (err ERR-ENDORSEMENT-NOT-FOUND)
  )
)

(define-public (verify-endorsement (id uint))
  (match (get-endorsement id)
    endorsement
      (begin
        (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
        (asserts! (not (get verified endorsement)) (err ERR-INVALID-VERIFICATION-STATUS))
        (map-set endorsements id (merge endorsement { verified: true }))
        (let ((new-score (calculate-score (get endorsee endorsement))))
          (print { event: "endorsement-verified", id: id, score: new-score })
        )
        (ok true)
      )
    (err ERR-ENDORSEMENT-NOT-FOUND)
  )
)

(define-public (update-endorsee-score (endorsee principal))
  (let ((score (calculate-score endorsee)))
    (ok score)
  )
)

(define-public (withdraw-stake (amount uint))
  (begin
    (asserts! (<= amount (get-endorser-stake tx-sender)) (err ERR-INSUFFICIENT-STAKE))
    (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))
    (map-set endorser-stakes tx-sender (- (get-endorser-stake tx-sender) amount))
    (ok true)
  )
)