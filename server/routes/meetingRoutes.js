
const express = require("express");
const { getMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting } = require("../controllers/meetingControllers")

const router = express.Router()

router.route("/").get(getMeetings).post(createMeeting)
router.route("/:id").get(getMeeting).put(updateMeeting).delete(deleteMeeting)

module.exports = router
